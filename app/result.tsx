import DrawResultForm from "@/components/draw-result-form";
import useDraw from "@/hooks/use-draw";
import { useAuthStore } from "@/store/auth";
import useDrawStore from "@/store/draw";
import api from "@/utils/axios";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, AlertTriangle, Calendar, Plus, X } from "lucide-react-native";
import React, { useState } from "react";
import {
    ActivityIndicator,
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

const ResultPage: React.FC = () => {
    const { createDrawResult } = useDraw();
    const { selectedDraw } = useDrawStore();

    const [mode, setMode] = useState<"view" | "edit">("view");
    const [formData, setFormData] = useState<Partial<DrawResult> | null>(null);
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [filterDate, setFilterDate] = useState<Date>(new Date());

    console.log("selectedDraw", selectedDraw);

    const {user} = useAuthStore()


    // Helper to format date as yyyy-mm-dd
    function formatDateServer(date: Date | null): string | null {
        if (!date) return null;
        const yyyy = date.getFullYear();
        const mm = String(date.getMonth() + 1).padStart(2, "0");
        const dd = String(date.getDate()).padStart(2, "0");
        return `${yyyy}-${mm}-${dd}`;
    }

    const filterDateString = formatDateServer(filterDate);

    console.log("filterDateString", filterDateString);


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

    const data = rawData?.[0]

    console.log("result", data, "filterDateString", filterDateString);


    /* ------------------- helpers ------------------- */
    const handleFormSubmit = async (resultData: any) => {
        console.log("on sbmit", resultData);

        await createDrawResult.mutateAsync({
            ...resultData,
            draw_session: selectedDraw?.id,
        });
        console.log("sucess");

        setMode("view");
        setFormData(null);
        refetch();
    };

    /* ------------------- states ------------------- */
    if (!selectedDraw?.id) {
        return (
            <View className="flex-1 items-center justify-center bg-gray-50">
                <AlertCircle size={48} color="#a1a1aa" />
                <Text className="mt-3 text-lg text-gray-500 font-semibold">No draw selected</Text>
            </View>
        );
    }

    /* ------------------- Edit mode ------------------- */
    if (mode === "edit") {
        return (
            <View className="flex-1 bg-gray-50">
                {/* top bar */}
                <View className="flex-row items-center bg-green-700 px-2 py-3  justify-between">
                    <Text className="text-lg font-bold text-white">Edit Result</Text>
                    <TouchableOpacity onPress={() => { setMode("view"); setFormData(null); }}>
                        <X size={22} color="#fff" />
                    </TouchableOpacity>
                </View>
                <DrawResultForm initialData={formData || undefined} onSubmit={handleFormSubmit} />
            </View>
        );
    }

    console.log("data", data);

    /* ------------------- View mode ------------------- */
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
                            {filterDate ? filterDate.toLocaleDateString() : new Date().toLocaleDateString()}
                        </Text>
                        <View className="ml-2">
                            <Calendar size={20} color="#2563eb" />
                        </View>
                    </TouchableOpacity>
                </View>

                {/* FAB to edit / add */}
                {
                    user?.user_type === "ADMIN" && <TouchableOpacity
                    onPress={() => {
                        setFormData(data || null);
                        setMode("edit");
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
                }
            </View>

            {/* Loading state */}
            {isLoading && (
                <View className="flex-1 items-center justify-center bg-gray-50 py-8">
                    <ActivityIndicator size="large" color="#15803d" />
                    <Text className="mt-2 text-base text-gray-500">Loading…</Text>
                </View>
            )}

            {/* Error handling for unpublished or failed result */}
            {!isLoading && error && (
                <View className="flex-1 items-center justify-center bg-gray-50 py-8">
                    <AlertTriangle size={40} color="#f59e42" />
                    <Text className={`mt-2 text-base font-semibold ${isNoResultYet ? "text-yellow-700" : "text-red-600"}`}>
                        {isNoResultYet
                            ? "Result not published yet for this draw"
                            : "Failed to load result"}
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
