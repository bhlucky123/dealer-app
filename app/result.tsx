import DrawResultForm from "@/components/draw-result-form";
import useDraw from "@/hooks/use-draw";
import { useAuthStore } from "@/store/auth";
import useDrawStore from "@/store/draw";
import api from "@/utils/axios";
import { formatDateDDMMYYYY } from "@/utils/date";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, AlertTriangle, Calendar, Pencil, Plus, X } from "lucide-react-native";
import React, { useState } from "react";
import {
    ActivityIndicator,
    Alert,
    ScrollView,
    Text,
    TouchableOpacity,
    View,
} from "react-native";

/** Prize row colours to match screenshot */
const PRIZE_COLOURS = [
    "bg-red-200/60",
    "bg-blue-200/60",
    "bg-amber-200/60",
    "bg-green-200/60",
    "bg-fuchsia-200/60",
];

export type DrawResult = {
    id: number;
    draw: string;
    published_at: string;
    first_prize: string;
    second_prize: string;
    third_prize: string;
    fourth_prize: string;
    fifth_prize: string;
    complementary_prizes: string[];
};

function isThreeDigitNumber(str: string) {
    return /^\d{3}$/.test(str);
}

function validateDrawResultFields(data: Partial<DrawResult> & { complementary_prizes?: string[] }) {
    // Check all main prizes
    const mainPrizes = [
        data.first_prize,
        data.second_prize,
        data.third_prize,
        data.fourth_prize,
        data.fifth_prize,
    ];
    for (let i = 0; i < mainPrizes.length; i++) {
        if (!mainPrizes[i] || typeof mainPrizes[i] !== "string" || !isThreeDigitNumber(mainPrizes[i]!)) {
            return `Please enter a valid 3-digit number for ${["First", "Second", "Third", "Fourth", "Fifth"][i]} Prize.`;
        }
    }
    // Check complementary prizes
    if (!Array.isArray(data.complementary_prizes) || data.complementary_prizes.length === 0) {
        return "Please enter all complementary prizes.";
    }
    for (let i = 0; i < data.complementary_prizes.length; i++) {
        const val = data.complementary_prizes[i];
        if (!val || !isThreeDigitNumber(val)) {
            return `Please enter a valid 3-digit number for Complementary Prize #${i + 1}.`;
        }
    }
    return null;
}

function canEditResult(published_at: string | undefined | null) {
    if (!published_at) return false;
    const publishedDate = new Date(published_at);
    const now = new Date();
    // Allow edit only within 1 hour of published_at
    return now.getTime() - publishedDate.getTime() < 60 * 60 * 1000;
}

const ResultPage: React.FC = () => {
    const { createDrawResult, updateDrawResult } = useDraw();
    const { selectedDraw } = useDrawStore();

    const [mode, setMode] = useState<"view" | "edit">("view");
    const [formData, setFormData] = useState<Partial<DrawResult> | null>(null);
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [filterDate, setFilterDate] = useState<Date>(new Date());
    const [formError, setFormError] = useState<string | null>(null);

    const { user } = useAuthStore();

    // Helper to format date as yyyy-mm-dd
    function formatDateServer(date: Date | null): string | null {
        if (!date) return null;
        const yyyy = date.getFullYear();
        const mm = String(date.getMonth() + 1).padStart(2, "0");
        const dd = String(date.getDate()).padStart(2, "0");
        return `${yyyy}-${mm}-${dd}`;
    }

    const filterDateString = formatDateServer(filterDate);

    const { data: rawData, isLoading, error, refetch } = useQuery<DrawResult[] | null>({
        queryKey: ["/draw-result/result/", selectedDraw?.id, filterDateString],
        queryFn: async () => {
            const res = await api.get(
                `/draw-result/result/?draw_session__draw__id=${selectedDraw?.id}&draw_session__session_date=${filterDateString ?? ""}`
            );
            return res.data;
        },
        enabled: !!selectedDraw?.id,
    });

    const data = rawData?.[0];

    // ------------------- helpers -------------------
    const handleFormSubmit = async (resultData: any) => {
        setFormError(null);
        // Validate all fields
        const validationError = validateDrawResultFields(resultData);
        if (validationError) {
            setFormError(validationError);
            Alert.alert("Validation Error", validationError);
            return;
        }

        try {
            if (data && data.id) {
                // Update
                await updateDrawResult.mutateAsync({
                    id: selectedDraw?.id,
                    ...resultData,
                });
            } else {
                // Create
                await createDrawResult.mutateAsync({
                    ...resultData,
                    draw_session: selectedDraw?.id,
                });
            }
            setMode("view");
            setFormData(null);
            refetch();
        } catch (err: any) {
            // Handle specific error: ["No draw session found for today."]
            if (Array.isArray(err) && err.length === 1 && err[0] === "No draw session found for today.") {
                setFormError("No draw session found for the selected date. Please check the draw schedule.");
                Alert.alert("No Draw Session", "No draw session found for the selected date. Please check the draw schedule.");
            } else {
                setFormError(err || "Failed to save result.");
                Alert.alert("Error", err || "Failed to save result.");
            }

            setTimeout(() => {
                setFormError("");
            }, 3000);
        }
    };

    // ------------------- states -------------------
    if (!selectedDraw?.id) {
        return (
            <View className="flex-1 items-center justify-center bg-gray-50">
                <AlertCircle size={48} color="#a1a1aa" />
                <Text className="mt-3 text-lg text-gray-500 font-semibold">No draw selected</Text>
            </View>
        );
    }

    // ------------------- Edit mode -------------------
    if (mode === "edit") {
        return (
            <View className="flex-1 bg-gray-50">
                {/* top bar */}
                <View className="flex-row items-center bg-green-700 px-2 py-3  justify-between">
                    <Text className="text-lg font-bold text-white">{data && data.id ? "Edit Result" : "Add Result"}</Text>
                    <TouchableOpacity onPress={() => { setMode("view"); setFormData(null); setFormError(null); }}>
                        <X size={22} color="#fff" />
                    </TouchableOpacity>
                </View>
                {formError ? (
                    <View className="bg-red-100 px-4 py-2">
                        <Text className="text-red-700 text-sm">{formError}</Text>
                    </View>
                ) : null}
                <DrawResultForm
                    initialData={formData || undefined}
                    onSubmit={handleFormSubmit}
                    validate={validateDrawResultFields}
                />
            </View>
        );
    }

    // ------------------- View mode -------------------
    // Always show the date filter and plus button, even if error or loading
    let errorMessage: string = "";
    let isNoResultYet = false;
    if (error || !data) {
        errorMessage =
            (error as any)?.message?.detail ||
            (error as any)?.message ||
            "";
        if (
            typeof errorMessage === "string" &&
            errorMessage.trim() === "No Result matches the given query."
        ) {
            isNoResultYet = true;
        }
    }

    // Only allow add if no result, and only allow edit if result is updated within 1 hour
    const canAdd = user?.user_type === "ADMIN" && !data;
    const canEditIcon = user?.user_type === "ADMIN" && data && canEditResult(data.published_at);

    return (
        <ScrollView className="flex-1">
            {/* Date filter */}
            <View className="px-4 pt-4 flex-row items-end justify-between">
                {/* Date filter section */}
                <View className="flex-1 mr-4">
                    <Text className="text-xs font-semibold text-gray-600 mb-1 ml-1 tracking-wider">
                        Date
                    </Text>
                    <TouchableOpacity
                        onPress={() => setShowDatePicker(true)}
                        className="flex-row items-center justify-between border border-gray-300 rounded-xl px-4 py-2 bg-white shadow-sm"
                        activeOpacity={0.85}
                    >
                        <Text className="text-base text-gray-800 font-medium">
                            {formatDateDDMMYYYY(filterDate || new Date())}
                        </Text>
                        <View className="ml-2">
                            <Calendar size={20} color="#2563eb" />
                        </View>
                    </TouchableOpacity>
                </View>

                {/* FAB to add */}
                {canAdd && (
                    <TouchableOpacity
                        onPress={() => {
                            setFormData({ complementary_prizes: [] });
                            setMode("edit");
                            setFormError(null);
                        }}
                        className="w-14 h-14 rounded-full bg-blue-600 items-center justify-center shadow-lg border-4 border-white"
                        style={{
                            elevation: 6,
                            shadowColor: "#2563eb",
                            shadowOffset: { width: 0, height: 2 },
                            shadowOpacity: 0.2,
                            shadowRadius: 4,
                        }}
                        activeOpacity={0.85}
                    >
                        <Plus size={26} color="#fff" />
                    </TouchableOpacity>
                )}

                {/* Edit icon for update, only if result is updated within 1 hour */}
                {canEditIcon && (
                    <TouchableOpacity
                        onPress={() => {
                            setFormData(data || { complementary_prizes: [] });
                            setMode("edit");
                            setFormError(null);
                        }}
                        className="w-14 h-14 rounded-full bg-yellow-500 items-center justify-center shadow-lg border-4 border-white ml-2"
                        style={{
                            elevation: 6,
                            shadowColor: "#fbbf24",
                            shadowOffset: { width: 0, height: 2 },
                            shadowOpacity: 0.2,
                            shadowRadius: 4,
                        }}
                        activeOpacity={0.85}
                    >
                        <Pencil size={26} color="#fff" />
                    </TouchableOpacity>
                )}
            </View>

            {/* Loading state */}
            {isLoading && (
                <View className="flex-1 items-center justify-center bg-gray-50 py-8">
                    <ActivityIndicator size="large" color="#15803d" />
                    <Text className="mt-2 text-base text-gray-500">Loading…</Text>
                </View>
            )}

            {/* Show "No result published" if not loading and no data */}
            {!isLoading && !data && (
                <View className="flex-1 items-center justify-center bg-gray-50 py-8">
                    <AlertTriangle size={40} color="#f59e42" />
                    <Text className="mt-2 text-base font-semibold text-yellow-700">
                        No result published yet for this draw
                    </Text>
                </View>
            )}

            {/* Error handling for other errors */}
            {!isLoading && error && data && (
                <View className="flex-1 items-center justify-center bg-gray-50 py-8">
                    <AlertTriangle size={40} color="#f59e42" />
                    <Text className="mt-2 text-base font-semibold text-red-600">
                        Failed to load result
                    </Text>
                </View>
            )}

            {/* Prize table */}
            {!isLoading && data && (
                <View className="mx-4 mt-6 border border-gray-300 rounded-lg overflow-hidden">
                    {(
                        [
                            { label: "First Price", value: data.first_prize },
                            { label: "Second Price", value: data.second_prize },
                            { label: "Third Price", value: data.third_prize },
                            { label: "Fourth Price", value: data.fourth_prize },
                            { label: "Fifth Price", value: data.fifth_prize },
                        ] as const
                    ).map((row, idx) => (
                        <View key={row.label} className={`flex-row ${PRIZE_COLOURS[idx]} border-b border-gray-300`}>
                            <Text className="w-10 text-center py-1.5 text-[11px] font-medium border-r border-gray-300 bg-white/20">
                                {idx + 1}
                            </Text>
                            <Text className="flex-1 py-1.5 text-[12px] font-bold text-center text-gray-800">
                                {row.label}
                            </Text>
                            <Text className="w-20 py-1.5 text-[13px] font-mono font-bold text-center border-l border-gray-300">
                                {row.value}
                            </Text>
                        </View>
                    ))}
                </View>
            )}

            {/* Complementary grid */}
            {!isLoading && data && (
                <View className="mx-4 mt-6 mb-10 border border-gray-300 rounded-lg overflow-hidden">
                    {Array.from({ length: Math.ceil(data.complementary_prizes.length / 3) }).map((_, r) => {
                        const rowPrizes = data.complementary_prizes.slice(r * 3, r * 3 + 3);
                        return (
                            <View key={`row-${r}`} className="flex-row border-b border-gray-200">
                                {rowPrizes.map((p, cIdx) => (
                                    <Text
                                        key={`prize-${r}-${cIdx}`}
                                        className="flex-1 py-2 text-center text-[12px] font-mono border-r border-gray-200"
                                    >
                                        {p}
                                    </Text>
                                ))}
                                {Array.from({ length: 3 - rowPrizes.length }).map((_, i) => (
                                    <Text key={`empty-${r}-${i}`} className="flex-1 border-r border-gray-200" />
                                ))}
                            </View>
                        );
                    })}
                </View>
            )}

            {/* Date picker modal */}
            {showDatePicker && (
                <DateTimePicker
                    mode="date"
                    value={filterDate || new Date()}
                    onChange={(_e, d) => {
                        if (d) setFilterDate(d);
                        setShowDatePicker(false);
                    }}
                />
            )}
        </ScrollView>
    );
};

export default ResultPage;
