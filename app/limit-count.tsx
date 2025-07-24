import useDrawStore from "@/store/draw";
import api from "@/utils/axios";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import React, { memo, useCallback, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    FlatList,
    KeyboardAvoidingView,
    Platform,
    Text,
    TextInput,
    ToastAndroid,
    TouchableOpacity,
    View,
} from "react-native";

type LimitCount = {
    id: number;
    number: number;
    count: number;
    draw: number;
};

// Memoized item to avoid hook error and unnecessary re-renders
const LimitCountItem = memo(
    ({
        item,
        updateLimitMutation,
        deleteLimitMutation,
    }: {
        item: LimitCount;
        updateLimitMutation: any;
        deleteLimitMutation: any;
    }) => {
        const [editCount, setEditCount] = useState(item.count.toString());
        const [isEditing, setIsEditing] = useState(false);

        return (
            <View className="bg-white rounded-xl mb-3 shadow shadow-black/10">
                <View className="flex-row items-end py-4 px-4">
                    <View className="flex-1">
                        <Text className="text-xs text-blue-gray-400 font-medium mb-0.5 tracking-tight">
                            Number
                        </Text>
                        <Text className="text-xl text-blue-gray-900 font-bold tracking-wide">
                            {item.number}
                        </Text>
                    </View>
                    <View className="flex-1">
                        <Text className="text-xs text-blue-gray-400 font-medium mb-0.5 tracking-tight">
                            Count
                        </Text>
                        {isEditing ? (
                            <TextInput
                                className="text-lg text-blue-600 font-semibold bg-blue-50 rounded px-2 py-1 border border-blue-100 min-w-[60px]"
                                value={editCount}
                                onChangeText={setEditCount}
                                keyboardType="number-pad"
                                placeholder="Count"
                                placeholderTextColor="#b0b0b0"
                                returnKeyType="done"
                            />
                        ) : (
                            <Text className="text-xl text-blue-600 font-bold tracking-wide">
                                {item.count}
                            </Text>
                        )}
                    </View>
                    <View className="flex-row items-center ml-2 space-x-1.5">
                        {isEditing ? (
                            <TouchableOpacity
                                className="bg-green-500 py-2 px-4 rounded justify-center items-center mr-0.5"
                                onPress={() => {
                                    const countNum = parseInt(editCount, 10);
                                    if (isNaN(countNum) || countNum < 0) {
                                        Alert.alert("Invalid", "Please enter a valid count.");
                                        return;
                                    }
                                    updateLimitMutation.mutate({ id: item.id, count: countNum });
                                    setIsEditing(false);
                                }}
                            >
                                <Text className="text-white font-bold text-base tracking-tight">
                                    Save
                                </Text>
                            </TouchableOpacity>
                        ) : (
                            <TouchableOpacity
                                className="bg-blue-50 py-1.5 px-4 rounded border border-blue-100 justify-center items-center mr-0.5"
                                onPress={() => setIsEditing(true)}
                            >
                                <Text className="text-blue-600 font-bold text-base tracking-tight">
                                    Edit
                                </Text>
                            </TouchableOpacity>
                        )}
                        <TouchableOpacity
                            className="bg-red-50 py-1.5 px-3 rounded border border-red-100 justify-center items-center"
                            onPress={() => {
                                Alert.alert(
                                    "Delete",
                                    `Delete limit for number ${item.number}?`,
                                    [
                                        { text: "Cancel", style: "cancel" },
                                        {
                                            text: "Delete",
                                            style: "destructive",
                                            onPress: () => deleteLimitMutation.mutate(item.id),
                                        },
                                    ]
                                );
                            }}
                        >
                            <Text className="text-red-500 font-black text-lg tracking-tight">✕</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        );
    }
);

const LimitCountScreen = () => {
    const { selectedDraw } = useDrawStore();
    const queryClient = useQueryClient();

    const [newNumber, setNewNumber] = useState("");
    const [newCount, setNewCount] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    const { data: limitCounts, isLoading, error } = useQuery<LimitCount[]>({
        queryKey: ["/draw/limit-number-count/", selectedDraw?.id],
        queryFn: async () => {
            if (!selectedDraw?.id) return [];
            const res = await api.get<LimitCount[]>(
                `/draw/limit-number-count/?draw__id=${selectedDraw.id}`
            );
            return res.data;
        },
        enabled: !!selectedDraw?.id,
    });

    const addLimitMutation = useMutation({
        mutationFn: (payload: { number: number; count: number; draw: number }) => {
            return api.post("/draw/limit-number-count/", payload);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: ["/draw/limit-number-count/", selectedDraw?.id],
            });
            setNewNumber("");
            setNewCount("");
            setIsSubmitting(false);
            ToastAndroid.show("Limit count added successfully.", ToastAndroid.SHORT);
        },
        onError: (err: any) => {
            setIsSubmitting(false);
            Alert.alert(
                "Error",
                err?.response?.data?.detail || "Failed to add limit count."
            );
        },
    });

    const updateLimitMutation = useMutation({
        mutationFn: (payload: { id: number; count: number }) => {
            return api.patch(`/draw/limit-number-count/${payload.id}/`, {
                count: payload.count,
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: ["/draw/limit-number-count/", selectedDraw?.id],
            });
            ToastAndroid.show("Limit count updated.", ToastAndroid.SHORT);
        },
        onError: (err: any) => {
            Alert.alert(
                "Error",
                err?.response?.data?.detail || "Failed to update limit count."
            );
        },
    });

    const deleteLimitMutation = useMutation({
        mutationFn: (id: number) => {
            return api.delete(`/draw/limit-number-count/${id}/`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: ["/draw/limit-number-count/", selectedDraw?.id],
            });
            ToastAndroid.show("Limit count deleted.",ToastAndroid.SHORT);
        },
        onError: (err: any) => {
            Alert.alert(
                "Error",
                err?.response?.data?.detail || "Failed to delete limit count."
            );
        },
    });

    const handleAddLimit = () => {
        if (!selectedDraw?.id) {
            Alert.alert("No Draw", "Please select a draw.");
            return;
        }
        const numberNum = parseInt(newNumber, 10);
        const countNum = parseInt(newCount, 10);
        if (isNaN(numberNum) || numberNum < 0 || isNaN(countNum) || countNum < 0) {
            Alert.alert("Invalid", "Please enter valid number and count.");
            return;
        }
        setIsSubmitting(true);
        addLimitMutation.mutate({
            number: numberNum,
            count: countNum,
            draw: selectedDraw.id,
        });
    };

    const renderHeader = () => (
        <View>
            <View className="bg-white rounded-xl p-4 mb-4 shadow shadow-black/10">
                <Text className="text-base font-semibold text-blue-600 mb-2 tracking-tight">
                    Add Limit
                </Text>
                <View className="flex-row items-end space-x-2 ">
                    <View className="flex-1">
                        <Text className="text-xs text-blue-gray-400 font-medium mb-1 tracking-tight">
                            Number
                        </Text>
                        <TextInput
                            className="rounded bg-blue-50 text-base text-blue-gray-900 px-3 py-2 mr-1 shadow shadow-blue-600/10"
                            placeholder="Number"
                            value={newNumber}
                            onChangeText={setNewNumber}
                            keyboardType="number-pad"
                            editable={!isSubmitting}
                            placeholderTextColor="#b0b0b0"
                            maxLength={3}
                            returnKeyType="next"
                        />
                    </View>
                    <View className="flex-1">
                        <Text className="text-xs text-blue-gray-400 font-medium mb-1 tracking-tight">
                            Count
                        </Text>
                        <TextInput
                            className="rounded bg-blue-50 text-base text-blue-gray-900 px-3 py-2 mr-1 shadow shadow-blue-600/10"
                            placeholder="Count"
                            value={newCount}
                            onChangeText={setNewCount}
                            keyboardType="number-pad"
                            editable={!isSubmitting}
                            placeholderTextColor="#b0b0b0"
                            returnKeyType="done"
                        />
                    </View>
                    <TouchableOpacity
                        className={`bg-blue-600 py-2 px-3 rounded justify-center items-center min-w-[70px] ml-0.5 shadow shadow-blue-600/20 ${isSubmitting ? "opacity-60" : ""
                            }`}
                        onPress={handleAddLimit}
                        disabled={isSubmitting}
                    >
                        <Text className="text-white font-bold text-base tracking-wide">
                            {isSubmitting ? "Adding..." : "Add"}
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );

    const renderLimitItem = useCallback(
        ({ item }: { item: LimitCount }) => (
            <LimitCountItem
                item={item}
                updateLimitMutation={updateLimitMutation}
                deleteLimitMutation={deleteLimitMutation}
            />
        ),
        [updateLimitMutation, deleteLimitMutation]
    );

    return (
        <KeyboardAvoidingView
            className="flex-1 bg-blue-50"
            behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
            <View className="flex-1 p-4 bg-blue-50">
                {isLoading ? (
                    <ActivityIndicator size="large" style={{ marginTop: 32 }} color="#2563eb" />
                ) : error ? (
                    <Text className="text-red-500 text-center mt-8 text-base font-semibold">
                        Failed to load limit counts.
                    </Text>
                ) : (
                    <View>
                        {renderHeader()}
                        <FlatList
                            data={limitCounts || []}
                            keyExtractor={(item) => item.id.toString()}
                            renderItem={renderLimitItem}
                            ListEmptyComponent={
                                <Text className="text-blue-gray-400 text-center mt-8 text-base font-medium">
                                    No limit counts found.
                                </Text>
                            }
                            contentContainerStyle={{ paddingBottom: 32 }}
                            showsVerticalScrollIndicator={false}
                            keyboardShouldPersistTaps="handled"
                        />
                    </View>
                )}
            </View>
        </KeyboardAvoidingView>
    );
};

export default LimitCountScreen;
