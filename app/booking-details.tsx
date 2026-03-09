import { useAuthStore } from "@/store/auth";
import { amountHandler } from "@/utils/amount";
import api from "@/utils/axios";
import { Ionicons } from "@expo/vector-icons";
import { FlashList } from "@shopify/flash-list";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from "react-native";

import { SafeAreaView } from "react-native-safe-area-context";

type BookingDetail = {
    id: number;
    number: string;
    count: number;
    amount: number;
    type: string;
    sub_type: string;
    is_main_box_number: boolean;
    dealer_amount: number;
    agent_amount: number;
    customer_amount: number;
};

type BookingRetrieveResponse = {
    bill_number: number;
    date_time: string;
    customer_name: string | null;
    booked_by_name: string | null;
    booked_by_type: string | null;
    total_booking_count: number;
    total_booking_amount: number;
    calculated_dealer_amount: number;
    calculated_agent_amount: number;
    booking_details: BookingDetail[];
    total_bill_count: number;
    total_dealer_amount: number;
    total_agent_amount: number;
    total_customer_amount: number;
    total_amount: number;
};

type DisplayRow = {
    key: string;
    id: number;
    number: string;
    count: number;
    amount: string;
    type: string;
    sub_type: string;
    dealer_amount: number;
    agent_amount: number;
    customer_amount: number;
};

function prepareDisplayRows(items: BookingDetail[]): DisplayRow[] {
    return items.map((item, i) => ({
        key: `bd_${item.id}_${i}`,
        id: item.id,
        number: item.number,
        count: item.count,
        amount: `₹${amountHandler(Number(item.amount))}`,
        type: item.type,
        sub_type: item.sub_type,
        dealer_amount: item.dealer_amount,
        agent_amount: item.agent_amount,
        customer_amount: item.customer_amount,
    }));
}

const ROW_HEIGHT = 50;

const rowStyles = StyleSheet.create({
    rowEven: { height: ROW_HEIGHT, flexDirection: "row", alignItems: "center", paddingHorizontal: 10, borderBottomWidth: 1, borderBottomColor: "#f3f4f6", backgroundColor: "#fff" },
    rowOdd: { height: ROW_HEIGHT, flexDirection: "row", alignItems: "center", paddingHorizontal: 10, borderBottomWidth: 1, borderBottomColor: "#f3f4f6", backgroundColor: "#f9fafb" },
    numCol: { flex: 1, alignItems: "center", justifyContent: "center" },
    numText: { fontSize: 14, color: "#047857", fontWeight: "700", letterSpacing: 1, textAlign: "center" },
    typeCol: { flex: 1, alignItems: "center", justifyContent: "center" },
    typeText: { fontSize: 11, color: "#7c3aed", fontWeight: "600", textAlign: "center" },
    subTypeText: { fontSize: 10, color: "#6b7280", textAlign: "center" },
    countCol: { flex: 0.6, alignItems: "center", justifyContent: "center" },
    countText: { fontSize: 12, color: "#374151", textAlign: "center" },
    amtCol: { flex: 1, alignItems: "flex-end", justifyContent: "center" },
    amtText: { fontSize: 12, color: "#6d28d9", fontWeight: "700", textAlign: "right" },
    custAmtCol: { flex: 1, alignItems: "flex-end", justifyContent: "center" },
    custAmtText: { fontSize: 12, color: "#047857", fontWeight: "700", textAlign: "right" },
    deleteCol: { width: 24, alignItems: "flex-end", justifyContent: "center" },
});

const headerStyles = StyleSheet.create({
    row: { flexDirection: "row", backgroundColor: "rgba(243,244,246,0.8)", borderBottomWidth: 1, borderBottomColor: "#e5e7eb", paddingHorizontal: 10, paddingVertical: 10 },
    col: { flex: 1, alignItems: "center" },
    countCol: { flex: 0.6, alignItems: "center" },
    amtCol: { flex: 1, alignItems: "flex-end" },
    text: { fontSize: 10, fontWeight: "600", color: "#4b5563", textTransform: "uppercase" },
    deleteCol: { width: 24 },
});

const footerStyle = { paddingVertical: 12, alignItems: "center" as const };
const emptyComponent = (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center", paddingVertical: 64 }}>
        <Text style={{ color: "#6b7280", fontSize: 14 }}>No booking details found.</Text>
    </View>
);

const DetailRow = React.memo(({ item, index, isSuperuser, onDelete }: {
    item: DisplayRow; index: number; isSuperuser: boolean; onDelete: (item: DisplayRow) => void;
}) => (
    <View style={index % 2 === 0 ? rowStyles.rowEven : rowStyles.rowOdd}>
        <View style={rowStyles.numCol}>
            <Text style={rowStyles.numText}>{item.number}</Text>
        </View>
        <View style={rowStyles.typeCol}>
            <Text style={rowStyles.typeText}>{item.sub_type}</Text>
            <Text style={rowStyles.subTypeText}>{item.type.replace(/_/g, " ")}</Text>
        </View>
        <View style={rowStyles.countCol}>
            <Text style={rowStyles.countText}>{item.count}</Text>
        </View>
        <View style={rowStyles.amtCol}>
            <Text style={rowStyles.amtText}>{item.amount}</Text>
        </View>
        <View style={rowStyles.custAmtCol}>
            <Text style={rowStyles.custAmtText}>₹{amountHandler(Number(item.customer_amount))}</Text>
        </View>
        {isSuperuser && (
            <View style={rowStyles.deleteCol}>
                <TouchableOpacity onPress={() => onDelete(item)} hitSlop={10}>
                    <Ionicons name="trash-outline" size={16} color="#ef4444" />
                </TouchableOpacity>
            </View>
        )}
    </View>
));

const BookingDetailsScreen = () => {
    const { user } = useAuthStore();
    const queryClient = useQueryClient();
    const params = useLocalSearchParams();
    const billNumber = params.bill_number as string | undefined;
    const initialSearch = (params.search as string) || "";

    const [search, setSearch] = useState(initialSearch);
    const [debouncedSearch, setDebouncedSearch] = useState(initialSearch);

    useEffect(() => {
        const handle = setTimeout(() => setDebouncedSearch(search.trim()), 300);
        return () => clearTimeout(handle);
    }, [search]);

    const isSuperuser = !!user?.superuser;

    const {
        data,
        isLoading,
        error,
        refetch,
    } = useQuery<BookingRetrieveResponse>({
        queryKey: ["booking-report-detail", billNumber, debouncedSearch],
        queryFn: () => {
            const searchParam = debouncedSearch ? `?search=${encodeURIComponent(debouncedSearch)}` : "";
            return api.get<BookingRetrieveResponse>(`/draw-booking/booking-report/${billNumber}/${searchParam}`).then(res => res.data);
        },
        enabled: !!billNumber,
    });

    const displayRows = useMemo(() => {
        if (!data?.booking_details) return [];
        return prepareDisplayRows(data.booking_details);
    }, [data?.booking_details]);

    const shouldShowTotalFooter = !!billNumber && !isLoading && !error && displayRows.length > 0;

    const overrideItemLayout = useCallback((layout: { span?: number; size?: number }) => {
        layout.size = ROW_HEIGHT;
    }, []);

    const handleDelete = useCallback((item: DisplayRow) => {
        if (!item.id) return;
        Alert.alert(
            "Delete Booking Detail",
            `Are you sure you want to delete booking detail "${item.id}"?`,
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            await api.delete(`/draw-booking/booking-detail-manage/${item.id}/`);
                            queryClient.invalidateQueries({ queryKey: ["booking-report-detail"] });
                            queryClient.invalidateQueries({ queryKey: ["/draw-booking/booking-report/"] });
                            refetch();
                        } catch (err) {
                            Alert.alert("Delete Failed", "Could not delete booking detail.");
                        }
                    }
                }
            ]
        );
    }, [queryClient, refetch]);

    const renderItem = useCallback(({ item, index }: { item: DisplayRow; index: number }) => (
        <DetailRow item={item} index={index} isSuperuser={isSuperuser} onDelete={handleDelete} />
    ), [isSuperuser, handleDelete]);

    const keyExtractor = useCallback((item: DisplayRow) => item.key, []);

    return (
        <SafeAreaView className="flex-1 bg-white" edges={["bottom"]}>
            <View className="flex-1 p-4">
                {/* Search */}
                <View className="mb-3 flex-row items-center gap-2">
                    <TextInput
                        value={search}
                        onChangeText={setSearch}
                        placeholder="Search by number..."
                        keyboardType="numeric"
                        className="flex-1 border border-gray-300 rounded-lg px-4 py-2.5 text-sm"
                        placeholderTextColor="#9ca3af"
                    />
                    {search.length > 0 && (
                        <TouchableOpacity
                            onPress={() => setSearch("")}
                            className="px-3 py-2.5 rounded-lg bg-red-50 border border-red-200"
                            activeOpacity={0.7}
                        >
                            <Text className="text-sm font-semibold text-red-600">✕</Text>
                        </TouchableOpacity>
                    )}
                </View>

                {/* Booking Header */}
                {data && (
                    <View className="mb-3 p-3 bg-gray-50 rounded-xl border border-gray-200">
                        <View className="flex-row justify-between mb-1">
                            <Text className="text-sm font-bold text-gray-800">Bill #{data.bill_number}</Text>
                            <Text className="text-xs text-gray-500">{data.booked_by_name}{data.booked_by_type ? ` (${data.booked_by_type})` : ""}</Text>
                        </View>
                        <View className="flex-row justify-between">
                            <Text className="text-xs text-gray-500">{data.customer_name || ""}</Text>
                            <Text className="text-xs text-gray-500">{data.date_time ? new Date(data.date_time).toLocaleString() : ""}</Text>
                        </View>
                    </View>
                )}

                {/* Main Content */}
                {!billNumber ? (
                    <View className="flex-1 justify-center items-center">
                        <Text className="text-base text-gray-500">No booking selected.</Text>
                    </View>
                ) : isLoading ? (
                    <View className="flex-1 justify-center items-center">
                        <ActivityIndicator size="large" color="#7c3aed" />
                        <Text className="mt-3 text-gray-600">Loading booking details...</Text>
                    </View>
                ) : error ? (
                    <View className="flex-1 justify-center items-center">
                        <View className="bg-red-50 border border-red-200 px-6 py-8 rounded-xl items-center shadow">
                            <Text className="text-red-700 font-bold text-lg mb-1">Error loading details</Text>
                            <TouchableOpacity onPress={() => refetch()} className="bg-violet-600 px-4 py-2 rounded-lg mt-3">
                                <Text className="text-white font-semibold">Retry</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                ) : (
                    <>
                        <View className="flex-1 rounded-2xl bg-white shadow-sm border border-gray-200 overflow-hidden">
                            {/* Header */}
                            <View style={headerStyles.row}>
                                <View style={headerStyles.col}>
                                    <Text style={headerStyles.text}>NUMBER</Text>
                                </View>
                                <View style={headerStyles.col}>
                                    <Text style={headerStyles.text}>TYPE</Text>
                                </View>
                                <View style={headerStyles.countCol}>
                                    <Text style={headerStyles.text}>CNT</Text>
                                </View>
                                <View style={headerStyles.amtCol}>
                                    <Text style={headerStyles.text}>AMT</Text>
                                </View>
                                <View style={headerStyles.amtCol}>
                                    <Text style={headerStyles.text}>C.AMT</Text>
                                </View>
                                {isSuperuser && <View style={headerStyles.deleteCol} />}
                            </View>
                            <FlashList
                                data={displayRows}
                                keyExtractor={keyExtractor}
                                renderItem={renderItem}
                                estimatedItemSize={ROW_HEIGHT}
                                overrideItemLayout={overrideItemLayout}
                                ListEmptyComponent={emptyComponent}
                                refreshing={false}
                                onRefresh={() => refetch()}
                            />
                        </View>

                        {shouldShowTotalFooter && data && (
                            <View className="border-t border-gray-200 py-3 bg-gray-100 px-4 mt-4 rounded-lg">
                                <View className="flex-row">
                                    <Text className="flex-1 font-bold text-sm text-gray-800">TOTAL</Text>
                                    <Text className="flex-1 text-sm text-center font-semibold text-gray-700">
                                        {data.total_bill_count}
                                    </Text>
                                    <Text className="flex-1 text-sm text-right font-semibold text-violet-700">
                                        ₹{amountHandler(Number(data.total_dealer_amount))}
                                    </Text>
                                    <Text className="flex-1 text-sm text-right font-semibold text-emerald-700">
                                        ₹{amountHandler(Number(data.total_customer_amount))}
                                    </Text>
                                </View>
                            </View>
                        )}
                    </>
                )}
            </View>
        </SafeAreaView>
    );
};

export default BookingDetailsScreen;
