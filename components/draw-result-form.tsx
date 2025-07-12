import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";

const DrawResultForm = ({  onSubmit }: {  onSubmit: (data: any) => void }) => {
    const [form, setForm] = useState({
        first_prize: '',
        second_prize: '',
        third_prize: '',
        fourth_prize: '',
        fifth_prize: '',
        complementary_prizes: Array(20).fill(''),
    });

    const handleInput = (key: string, value: string) => {
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
            style={{ flex: 1 }}
            keyboardVerticalOffset={80}
        >
            <View className="bg-white rounded-xl p-4 my-4 border border-gray-200 flex-1">
                <ScrollView
                    contentContainerStyle={{ paddingBottom: 100 }}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                >
                    <Text className="text-lg font-bold mb-4">Add Draw Result</Text>

                    {['first_prize', 'second_prize', 'third_prize', 'fourth_prize', 'fifth_prize'].map((key) => (
                        <View key={key} className="mb-2">
                            <Text className="mb-1 capitalize">{key.replace('_', ' ')}</Text>
                            <TextInput
                                className="border border-gray-300 rounded-xl p-2"
                                keyboardType="numeric"
                                placeholder="e.g. 123"
                                value={typeof form[key] === "string" ? form[key] : ""}
                                onChangeText={(text) => handleInput(key, text)}
                            />
                        </View>
                    ))}

                    <Text className="mt-4 font-semibold mb-2">Complementary Prizes</Text>
                    {form.complementary_prizes.map((val, idx) => (
                        <TextInput
                            key={idx}
                            className="border border-gray-300 rounded-xl p-2 mb-2"
                            keyboardType="numeric"
                            placeholder={`Prize ${idx + 1}`}
                            value={val}
                            onChangeText={(text) => handleComplementaryChange(idx, text)}
                        />
                    ))}
                </ScrollView>
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
                    }}
                >
                    <TouchableOpacity
                        className="bg-green-600 px-4 py-2 rounded-xl text-center"
                        onPress={() => onSubmit(form)}
                        activeOpacity={0.8}
                    >
                        <Text className="text-white font-bold text-center">Submit</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </KeyboardAvoidingView>
    );
};

export default DrawResultForm