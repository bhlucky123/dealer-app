import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";

type PrizeKey = "first_prize" | "second_prize" | "third_prize" | "fourth_prize" | "fifth_prize";
const PRIZE_LABELS: Record<PrizeKey, string> = {
    first_prize: "First Prize",
    second_prize: "Second Prize",
    third_prize: "Third Prize",
    fourth_prize: "Fourth Prize",
    fifth_prize: "Fifth Prize",
};
const PRIZE_COLOURS = [
    "bg-red-200/60",
    "bg-blue-200/60",
    "bg-amber-200/60",
    "bg-green-200/60",
    "bg-fuchsia-200/60",
];

type Props = {
    onSubmit: (data: any) => void;
    initialData?: any;
};

const DrawResultForm = ({ onSubmit, initialData }: Props) => {
    const [form, setForm] = useState({
        first_prize: initialData?.first_prize || '',
        second_prize: initialData?.second_prize || '',
        third_prize: initialData?.third_prize || '',
        fourth_prize: initialData?.fourth_prize || '',
        fifth_prize: initialData?.fifth_prize || '',
        complementary_prizes: initialData?.complementary_prizes || Array(20).fill(''),
    });

    const handleInput = (key: PrizeKey, value: string) => {
        setForm((prev) => ({ ...prev, [key]: value }));
    };

    const handleComplementaryChange = (index: number, value: string) => {
        const updated = [...form.complementary_prizes];
        updated[index] = value;
        setForm((prev) => ({ ...prev, complementary_prizes: updated }));
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={{ flex: 1, backgroundColor: "#f9fafb" }} // bg-gray-50
            keyboardVerticalOffset={80}
        >
            <View className="flex-1 bg-gray-50">
                <ScrollView
                    className="flex-1"
                    contentContainerStyle={{ paddingBottom: 120 }}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                >
                    {/* Prize table style inputs */}
                    <View className="mx-4 mt-6 border border-gray-300 rounded-lg overflow-hidden">
                        {(Object.keys(PRIZE_LABELS) as PrizeKey[]).map((key, idx) => (
                            <View
                                key={key}
                                className={`flex-row items-center ${PRIZE_COLOURS[idx]} border-b border-gray-300`}
                            >
                                <Text className="w-10 text-center py-1.5 text-[11px] font-medium border-r border-gray-300 bg-white/20">
                                    {idx + 1}
                                </Text>
                                <Text className="flex-1 py-1.5 text-[12px] font-bold text-center text-gray-800">
                                    {PRIZE_LABELS[key]}
                                </Text>
                                <View className="w-24 border-l border-gray-300 px-2 py-1.5">
                                    <TextInput
                                        className="text-center text-[13px] font-mono font-bold text-gray-900 bg-white rounded-md border border-gray-300 px-2 py-1"
                                        keyboardType="numeric"
                                        placeholder="e.g. 123"
                                        value={typeof form[key] === "string" ? form[key] : ""}
                                        onChangeText={(text) => handleInput(key, text)}
                                        maxLength={10}
                                    />
                                </View>
                            </View>
                        ))}
                    </View>

                    {/* Complementary grid style inputs */}
                    <Text className="mx-4 mt-8 mb-2 text-base font-semibold text-gray-700 tracking-wide">
                        Complementary Prizes
                    </Text>
                    <View className="mx-4 border border-gray-300 rounded-lg overflow-hidden mb-10">
                        {Array.from({ length: Math.ceil(form.complementary_prizes.length / 3) }).map((_, r) => (
                            <View key={r} className="flex-row border-b border-gray-200">
                                {form.complementary_prizes.slice(r * 3, r * 3 + 3).map((val: string, cIdx: number) => (
                                    <View
                                        key={r * 3 + cIdx}
                                        className="flex-1 border-r border-gray-200 px-2 py-2 bg-white"
                                        style={{ minWidth: 0 }}
                                    >
                                        <TextInput
                                            className="text-center text-[13px] font-mono font-bold text-gray-900 bg-gray-50 rounded-md border border-gray-300 px-2 py-1"
                                            keyboardType="numeric"
                                            placeholder={`Prize ${r * 3 + cIdx + 1}`}
                                            value={val}
                                            onChangeText={(text) => handleComplementaryChange(r * 3 + cIdx, text)}
                                            maxLength={10}
                                        />
                                    </View>
                                ))}
                                {/* Fill empty cells if needed */}
                                {new Array(3 - form.complementary_prizes.slice(r * 3, r * 3 + 3).length)
                                    .fill("")
                                    .map((_, i) => (
                                        <View
                                            key={`empty-${i}`}
                                            className="flex-1 border-r border-gray-200 px-2 py-2 bg-white"
                                        />
                                    ))}
                            </View>
                        ))}
                    </View>
                </ScrollView>
                {/* Submit button bar */}
                <View
                    style={{
                        position: "absolute",
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: "white",
                        paddingHorizontal: 16,
                        paddingBottom: 16,
                        paddingTop: 8,
                        borderTopWidth: 1,
                        borderColor: "#e5e7eb", // border-gray-200
                        shadowColor: "#000",
                        shadowOffset: { width: 0, height: -2 },
                        shadowOpacity: 0.06,
                        shadowRadius: 4,
                        elevation: 8,
                    }}
                >
                    <TouchableOpacity
                        className="bg-green-700 px-4 py-3 rounded-xl items-center justify-center shadow-lg"
                        onPress={() => onSubmit(form)}
                        activeOpacity={0.85}
                        style={{
                            elevation: 4,
                            shadowColor: "#15803d",
                            shadowOffset: { width: 0, height: 2 },
                            shadowOpacity: 0.15,
                            shadowRadius: 4,
                        }}
                    >
                        <Text className="text-white font-bold text-center text-base tracking-wide">Submit</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </KeyboardAvoidingView>
    );
};

export default DrawResultForm