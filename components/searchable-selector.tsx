import React, { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react-native";
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, StyleProp, StyleSheet, Text, TextInput, TextStyle, View, ViewStyle } from "react-native";

type Item = Record<string, any>;
type Props = {
  data: Item[]; labelField: string; valueField: string; value: any;
  onChange: (item: any) => void; placeholder?: string; loading?: boolean;
  disabled?: boolean; style?: StyleProp<ViewStyle>;
  selectedTextStyle?: StyleProp<TextStyle>; itemTextStyle?: StyleProp<TextStyle>;
  placeholderStyle?: StyleProp<TextStyle>;
  containerStyle?: StyleProp<ViewStyle>; renderRightIcon?: () => React.ReactNode;
  search?: boolean; searchPlaceholder?: string; maxHeight?: number;
  inputSearchStyle?: StyleProp<TextStyle>;
};

export function Dropdown({ data, labelField, valueField, value, onChange, placeholder = "Select", loading, disabled, style, selectedTextStyle, placeholderStyle, itemTextStyle, inputSearchStyle }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const selected = data.find(item => String(item[valueField]) === String(value));
  const rows = useMemo(() => data.filter(item => String(item[labelField] ?? "").toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())), [data, labelField, search]);
  const close = () => { setOpen(false); setSearch(""); };
  const choose = (item: Item) => { onChange(item); close(); };
  return <>
    <Pressable accessibilityRole="button" accessibilityLabel={placeholder} disabled={disabled} onPress={() => setOpen(true)} style={[styles.trigger, style]}>
      <Text style={[styles.text, selected ? selectedTextStyle : placeholderStyle]} numberOfLines={1}>{selected?.[labelField] ?? placeholder}</Text>
      <View style={styles.chevron} pointerEvents="none">
        <ChevronDown size={18} color="#64748b" strokeWidth={2.5} />
      </View>
    </Pressable>
    <Modal visible={open} transparent animationType="fade" onRequestClose={close}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.overlay}>
        <View accessibilityViewIsModal style={styles.panel}>
          <View style={styles.row}><Text style={styles.title}>{placeholder}</Text><Pressable accessibilityRole="button" onPress={close} style={styles.action}><Text>Close</Text></Pressable></View>
          <TextInput accessibilityLabel="Search options" placeholder="Search…" value={search} onChangeText={setSearch} autoCorrect={false} style={[styles.search, inputSearchStyle]} />
          <Pressable accessibilityRole="button" onPress={() => choose({ [valueField]: data.some(item => item[valueField] === null) ? null : "", [labelField]: "" })} style={styles.action}><Text>Clear selection</Text></Pressable>
          {loading ? <ActivityIndicator accessibilityLabel="Loading options" style={styles.action} /> : <FlatList
            data={rows} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" initialNumToRender={20} windowSize={7}
            keyExtractor={(item, index) => `${item[valueField]}-${index}`}
            ListEmptyComponent={<Text style={styles.action}>{search ? "No matching options" : "No options available"}</Text>}
            renderItem={({ item }) => { const active = String(item[valueField]) === String(value); return <Pressable accessibilityRole="button" accessibilityState={{ selected: active }} onPress={() => choose(item)} style={[styles.option, active && styles.selected]}><Text style={[styles.text, itemTextStyle]}>{item[labelField]}</Text>{active && <Text>✓</Text>}</Pressable>; }}
          />}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  </>;
}

const styles = StyleSheet.create({
  trigger: { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 8, padding: 12, backgroundColor: "white" },
  chevron: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "#f1f5f9" },
  text: { flex: 1, color: "#111827" }, overlay: { flex: 1, backgroundColor: "#0008", justifyContent: "center", padding: 20 },
  panel: { height: "80%", maxHeight: 600, backgroundColor: "white", borderRadius: 16, padding: 12 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, title: { fontWeight: "600", fontSize: 18, flex: 1 },
  action: { padding: 14 }, search: { borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 8, padding: 12, color: "#111827" },
  option: { minHeight: 52, padding: 14, flexDirection: "row", alignItems: "center", borderBottomWidth: StyleSheet.hairlineWidth, borderColor: "#e2e8f0" }, selected: { backgroundColor: "#dff4ef" },
});
