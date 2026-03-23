import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  ToastAndroid,
  ActivityIndicator,
  Image,
  ScrollView,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import MlkitOcr from "react-native-mlkit-ocr";
import { Ionicons } from "@expo/vector-icons";

type ExtractedRow = {
  game: string;
  number: string;
  count: string;
};

export default function ImageExtractScreen() {
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [rows, setRows] = useState<ExtractedRow[]>([]);
  const [loading, setLoading] = useState(false);

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 1,
    });

    if (!result.canceled && result.assets[0]) {
      const uri = result.assets[0].uri;
      setImageUri(uri);
      extractText(uri);
    }
  };

  const extractText = async (uri: string) => {
    setLoading(true);
    setRows([]);
    try {
      const ocrResult = await MlkitOcr.detectFromUri(uri);

      const GAME_TYPES = ["SUPER", "BOX", "SINGLE", "DOUBLE", "AB", "AC", "BC"];

      // Step 1: Collect every word/element with its Y-center position
      type WordItem = { text: string; x: number; y: number };
      const words: WordItem[] = [];

      for (const block of ocrResult) {
        for (const line of block.lines) {
          // Try individual elements (words) first for precise positioning
          if (line.elements?.length) {
            for (const el of line.elements) {
              const frame = el.frame || el.bounding || el.cornerPoints;
              let x = 0, y = 0;
              if (frame) {
                x = frame.left ?? frame.x ?? 0;
                y = (frame.top ?? frame.y ?? 0) + ((frame.height ?? 0) / 2);
              }
              words.push({ text: el.text.trim(), x, y });
            }
          } else {
            // Fallback: use the whole line
            const frame = line.frame || line.bounding || line.cornerPoints;
            let x = 0, y = 0;
            if (frame) {
              x = frame.left ?? frame.x ?? 0;
              y = (frame.top ?? frame.y ?? 0) + ((frame.height ?? 0) / 2);
            }
            // Split line text into individual words
            const parts = line.text.trim().split(/\s+/);
            for (const part of parts) {
              words.push({ text: part, x, y });
            }
          }
        }
      }

      // Step 2: Group words into rows by similar Y-coordinate
      // Sort by Y first
      words.sort((a, b) => a.y - b.y);

      const rowGroups: WordItem[][] = [];
      const Y_THRESHOLD = 15; // pixels tolerance for same row

      for (const word of words) {
        if (!word.text) continue;
        let added = false;
        for (const group of rowGroups) {
          const avgY = group.reduce((s, w) => s + w.y, 0) / group.length;
          if (Math.abs(word.y - avgY) < Y_THRESHOLD) {
            group.push(word);
            added = true;
            break;
          }
        }
        if (!added) {
          rowGroups.push([word]);
        }
      }

      // Step 3: Sort each row by X-coordinate (left to right)
      for (const group of rowGroups) {
        group.sort((a, b) => a.x - b.x);
      }

      // Step 4: Parse each row to find GAME, NUM, COUNT
      const parsed: ExtractedRow[] = [];

      for (const group of rowGroups) {
        const texts = group.map((w) => w.text);
        const lineStr = texts.join(" ");
        const parts = lineStr.split(/\s+/);

        let game = "";
        const digits: string[] = [];

        for (const p of parts) {
          const upper = p.toUpperCase();
          if (GAME_TYPES.includes(upper)) {
            game = upper;
          } else if (/^\d+$/.test(p)) {
            digits.push(p);
          }
        }

        if (game && digits.length >= 2) {
          parsed.push({ game, number: digits[0], count: digits[1] });
        } else if (digits.length >= 2) {
          // Row has 2+ numbers but no game type — could be a data row
          // Skip header rows like "GAME NUM COUNT"
          parsed.push({ game: "SUPER", number: digits[0], count: digits[1] });
        }
      }

      // Step 5: Fallback — if positional grouping found nothing,
      // try simple line-by-line parsing
      if (parsed.length === 0) {
        const allLines: string[] = [];
        for (const block of ocrResult) {
          for (const line of block.lines) {
            allLines.push(line.text.trim());
          }
        }

        for (const line of allLines) {
          const parts = line.split(/\s+/);
          let game = "";
          const digits: string[] = [];

          for (const p of parts) {
            const upper = p.toUpperCase();
            if (GAME_TYPES.includes(upper)) {
              game = upper;
            } else if (/^\d+$/.test(p)) {
              digits.push(p);
            }
          }

          if (digits.length >= 2) {
            parsed.push({ game: game || "SUPER", number: digits[0], count: digits[1] });
          }
        }
      }

      setRows(parsed);
      if (parsed.length === 0) {
        ToastAndroid.show("No numbers found in image", ToastAndroid.SHORT);
      }
    } catch (e) {
      console.error("OCR error:", e);
      ToastAndroid.show("Failed to read image", ToastAndroid.SHORT);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    if (rows.length === 0) return;

    const lines = rows.map((r) => {
      if (r.game.toUpperCase() === "SUPER") {
        return `${r.number} ${r.count}`;
      }
      return `${r.number} ${r.count} ${r.game.toLowerCase()}`;
    });
    const text = lines.join("\n");

    try {
      const RNClipboard = require("@react-native-clipboard/clipboard");
      if (RNClipboard?.default?.setString) {
        RNClipboard.default.setString(text);
      } else {
        RNClipboard.Clipboard.setString(text);
      }
    } catch {
      ToastAndroid.show("Clipboard not available", ToastAndroid.SHORT);
      return;
    }
    ToastAndroid.show("Copied to clipboard!", ToastAndroid.SHORT);
  };

  return (
    <View className="flex-1 bg-gray-50">
      <ScrollView className="flex-1 p-4" contentContainerStyle={{ paddingBottom: 20 }}>
        {/* Pick Image Button */}
        <TouchableOpacity
          onPress={pickImage}
          className="bg-orange-500 rounded-2xl py-4 flex-row items-center justify-center mb-4"
          style={{ gap: 8 }}
        >
          <Ionicons name="image-outline" size={22} color="#fff" />
          <Text className="text-white font-bold text-base">
            {imageUri ? "Pick Another Image" : "Pick Image from Gallery"}
          </Text>
        </TouchableOpacity>

        {/* Image Preview */}
        {imageUri && (
          <View className="bg-white rounded-2xl overflow-hidden mb-4 shadow-sm">
            <Image
              source={{ uri: imageUri }}
              style={{ width: "100%", height: 200 }}
              resizeMode="contain"
            />
          </View>
        )}

        {/* Loading */}
        {loading && (
          <View className="items-center py-8">
            <ActivityIndicator size="large" color="#f97316" />
            <Text className="text-gray-500 mt-2">Reading image...</Text>
          </View>
        )}

        {/* Results */}
        {rows.length > 0 && (
          <View className="bg-white rounded-2xl p-4 shadow-sm">
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-lg font-bold text-gray-800">
                Extracted Numbers ({rows.length})
              </Text>
              <TouchableOpacity
                onPress={copyToClipboard}
                className="flex-row items-center bg-blue-600 rounded-lg px-4 py-2"
                style={{ gap: 6 }}
              >
                <Ionicons name="copy-outline" size={16} color="#fff" />
                <Text className="text-white font-semibold text-sm">Copy All</Text>
              </TouchableOpacity>
            </View>

            {/* Table Header */}
            <View className="flex-row border-b-2 border-gray-200 pb-2 mb-1">
              <Text className="font-bold text-xs text-gray-500" style={{ width: 70 }}>
                GAME
              </Text>
              <Text className="flex-1 font-bold text-xs text-gray-500 text-center">
                NUM
              </Text>
              <Text className="font-bold text-xs text-gray-500 text-right" style={{ width: 60 }}>
                COUNT
              </Text>
            </View>

            {/* Table Rows */}
            <FlatList
              data={rows}
              scrollEnabled={false}
              keyExtractor={(_, idx) => idx.toString()}
              renderItem={({ item }) => (
                <View className="flex-row items-center py-2.5 border-b border-gray-100">
                  <Text className="text-sm font-semibold text-orange-600" style={{ width: 70 }}>
                    {item.game}
                  </Text>
                  <Text className="flex-1 text-sm font-bold text-gray-800 text-center">
                    {item.number}
                  </Text>
                  <Text className="text-sm text-gray-600 text-right" style={{ width: 60 }}>
                    {item.count}
                  </Text>
                </View>
              )}
            />

            {/* Copy preview */}
            <View className="mt-4 bg-gray-900 rounded-xl p-3">
              <Text className="text-xs text-gray-400 mb-1 font-semibold">COPY PREVIEW</Text>
              <Text className="text-sm text-gray-100 font-mono" style={{ lineHeight: 22 }}>
                {rows
                  .map((r) =>
                    r.game.toUpperCase() === "SUPER"
                      ? `${r.number} ${r.count}`
                      : `${r.number} ${r.count} ${r.game.toLowerCase()}`
                  )
                  .join("\n")}
              </Text>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
