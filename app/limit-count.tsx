import useDrawStore from "@/store/draw";
import api from "@/utils/axios";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { memo, useCallback, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    FlatList,
    KeyboardAvoidingView,
    Platform,
    SafeAreaView,
    Text,
    TextInput,
    ToastAndroid,
    TouchableOpacity,
    View,
} from "react-native";

type LimitCount = {
    id: number;
    number: string;
    count: number;
    draw: number;
    limit_type: "single_number" | "range";
    range_start: string;
    range_end: string;
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

        // For range, show the range as a string
        const displayNumber =
            item.limit_type === "range"
                ? `${item.range_start} - ${item.range_end}`
                : item.number;

        return (
            <View className="bg-white rounded-xl mb-3 shadow shadow-black/10">
                <View className="flex-row items-end py-4 px-4">
                    <View className="flex-1">
                        <Text className="text-xs text-blue-gray-400 font-medium mb-0.5 tracking-tight">
                            {item.limit_type === "range" ? "Range" : "Number"}
                        </Text>
                        <Text className="text-xl text-blue-gray-900 font-bold tracking-wide">
                            {displayNumber}
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
                                    updateLimitMutation.mutate({
                                        id: item.id,
                                        count: countNum,
                                        limit_type: item.limit_type,
                                        range_start: item.range_start,
                                        range_end: item.range_end,
                                        number: item.number,
                                    });
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
                                    item.limit_type === "range"
                                        ? `Delete limit for range ${item.range_start} - ${item.range_end}?`
                                        : `Delete limit for number ${item.number}?`,
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

    // UI state for adding new limit
    const [limitType, setLimitType] = useState<"single_number" | "range">("single_number");
    const [newNumber, setNewNumber] = useState("");
    const [newRangeStart, setNewRangeStart] = useState("");
    const [newRangeEnd, setNewRangeEnd] = useState("");
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
        mutationFn: (payload: {
            number: string;
            count: number;
            limit_type: "single_number" | "range";
            range_start: string;
            range_end: string;
            draw: number;
        }) => {
            return api.post("/draw/limit-number-count/", payload);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: ["/draw/limit-number-count/", selectedDraw?.id],
            });
            setNewNumber("");
            setNewRangeStart("");
            setNewRangeEnd("");
            setNewCount("");
            setIsSubmitting(false);
            ToastAndroid.show("Limit count added successfully.", ToastAndroid.SHORT);
        },
        onError: (err: any) => {
            setIsSubmitting(false);
            let errorMsg =
                err?.response?.data?.non_field_errors?.[0] ||
                err?.message?.non_field_errors?.[0] ||
                "Failed to add limit count.";
            if (
                errorMsg === "The fields draw, number must make a unique set." ||
                errorMsg === "The fields draw, range_start, range_end must make a unique set."
            ) {
                errorMsg = "This number or range is already limited for the selected draw.";
            }
            Alert.alert("Error", errorMsg);
        },
    });

    const updateLimitMutation = useMutation({
        mutationFn: (payload: {
            id: number;
            count: number;
            limit_type: "single_number" | "range";
            range_start: string;
            range_end: string;
            number: string;
        }) => {
            // PATCH only count, but keep other info for UI
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
            ToastAndroid.show("Limit count deleted.", ToastAndroid.SHORT);
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
        const countNum = parseInt(newCount, 10);

        if (isNaN(countNum) || countNum < 0) {
            Alert.alert("Invalid", "Please enter a valid count.");
            return;
        }

        if (limitType === "single_number") {
            const trimmedNumber = newNumber.trim();
            if (!/^\d+$/.test(trimmedNumber) || trimmedNumber.length === 0) {
                Alert.alert("Invalid", "Please enter a valid number.");
                return;
            }
            setIsSubmitting(true);
            addLimitMutation.mutate({
                number: trimmedNumber,
                count: countNum,
                limit_type: "single_number",
                range_start: "",
                range_end: "",
                draw: selectedDraw.id,
            });
        } else {
            // range
            const trimmedStart = newRangeStart.trim();
            const trimmedEnd = newRangeEnd.trim();
            if (
                !/^\d+$/.test(trimmedStart) ||
                !/^\d+$/.test(trimmedEnd) ||
                trimmedStart.length === 0 ||
                trimmedEnd.length === 0
            ) {
                Alert.alert("Invalid", "Please enter valid range start and end.");
                return;
            }
            if (parseInt(trimmedStart, 10) > parseInt(trimmedEnd, 10)) {
                Alert.alert("Invalid", "Range start should be less than or equal to range end.");
                return;
            }
            setIsSubmitting(true);
            addLimitMutation.mutate({
                number: "",
                count: countNum,
                limit_type: "range",
                range_start: trimmedStart,
                range_end: trimmedEnd,
                draw: selectedDraw.id,
            });
        }
    };

    const renderHeader = () => (
        <View>
            <View className="bg-white rounded-xl p-4 mb-4 shadow shadow-black/10">
                <Text className="text-base font-semibold text-blue-600 mb-2 tracking-tight">
                    Add Limit
                </Text>
                <View className="flex-row items-center mb-2">
                    <TouchableOpacity
                        className={`px-3 py-1.5 rounded mr-2 ${limitType === "single_number"
                            ? "bg-blue-600"
                            : "bg-blue-50 border border-blue-200"
                            }`}
                        onPress={() => setLimitType("single_number")}
                        disabled={isSubmitting}
                    >
                        <Text className={`font-bold text-base tracking-tight ${limitType === "single_number" ? "text-white" : "text-blue-600"}`}>
                            Single Number
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        className={`px-3 py-1.5 rounded ${limitType === "range"
                            ? "bg-blue-600"
                            : "bg-blue-50 border border-blue-200"
                            }`}
                        onPress={() => setLimitType("range")}
                        disabled={isSubmitting}
                    >
                        <Text className={`font-bold text-base tracking-tight ${limitType === "range" ? "text-white" : "text-blue-600"}`}>
                            Range
                        </Text>
                    </TouchableOpacity>
                </View>
                <View className="flex-row items-end space-x-2 ">
                    {limitType === "single_number" ? (
                        <>
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
                        </>
                    ) : (
                        <>
                            <View className="flex-1">
                                <Text className="text-xs text-blue-gray-400 font-medium mb-1 tracking-tight">
                                    Range Start
                                </Text>
                                <TextInput
                                    className="rounded bg-blue-50 text-base text-blue-gray-900 px-3 py-2 mr-1 shadow shadow-blue-600/10"
                                    placeholder="Start"
                                    value={newRangeStart}
                                    onChangeText={setNewRangeStart}
                                    keyboardType="number-pad"
                                    editable={!isSubmitting}
                                    placeholderTextColor="#b0b0b0"
                                    maxLength={3}
                                    returnKeyType="next"
                                />
                            </View>
                            <View className="flex-1">
                                <Text className="text-xs text-blue-gray-400 font-medium mb-1 tracking-tight">
                                    Range End
                                </Text>
                                <TextInput
                                    className="rounded bg-blue-50 text-base text-blue-gray-900 px-3 py-2 mr-1 shadow shadow-blue-600/10"
                                    placeholder="End"
                                    value={newRangeEnd}
                                    onChangeText={setNewRangeEnd}
                                    keyboardType="number-pad"
                                    editable={!isSubmitting}
                                    placeholderTextColor="#b0b0b0"
                                    maxLength={3}
                                    returnKeyType="next"
                                />
                            </View>
                        </>
                    )}
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
            <SafeAreaView className="flex-1 p-4 mb-24 pb-24 bg-blue-50">
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
            </SafeAreaView>
        </KeyboardAvoidingView>
    );
};

export default LimitCountScreen;
