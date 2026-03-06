import { useAuthStore } from "@/store/auth";
import useDrawStore from "@/store/draw";
import { amountHandler } from "@/utils/amount";
import api from "@/utils/axios";
import { Ionicons } from "@expo/vector-icons";
import { FlashList } from "@shopify/flash-list";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from "react-native";
import { Dropdown } from "react-native-element-dropdown";
import { SafeAreaView } from "react-native-safe-area-context";

type BookingDetail = {
    id: number;
    bill_number: number;
    draw: string;
    booked_by_name: string;
    number: string;
    count: number;
    amount: number;
    type: string;
    sub_type: string;
    is_main_box_number: boolean;
};

type BookingDetailsResponse = {
    count: number;
    total_pages: number;
    next: number | null;
    previous: number | null;
    results: BookingDetail[];
    total_count: number;
    total_amount: number;
};

type DisplayRow = {
    key: string;
    id: number;
    bill_number: number;
    draw: string;
    booked_by_name: string;
    number: string;
    count: number;
    amount: string;
    type: string;
    sub_type: string;
};

function prepareDisplayRows(items: BookingDetail[]): DisplayRow[] {
    return items.map((item, i) => ({
        key: `bd_${item.id}_${i}`,
        id: item.id,
        bill_number: item.bill_number,
        draw: item.draw,
        booked_by_name: item.booked_by_name,
        number: item.number,
        count: item.count,
        amount: `₹${amountHandler(Number(item.amount))}`,
        type: item.type,
        sub_type: item.sub_type,
    }));
}

const typeOptions = [
    { label: "Single Digit", value: "single_digit" },
    { label: "Double Digit", value: "double_digit" },
    { label: "Triple Digit", value: "triple_digit" },
];

const subTypeOptions = [
    { label: "A", value: "A" },
    { label: "B", value: "B" },
    { label: "C", value: "C" },
    { label: "AB", value: "AB" },
    { label: "BC", value: "BC" },
    { label: "AC", value: "AC" },
    { label: "SUPER", value: "SUPER" },
    { label: "BOX", value: "BOX" },
];

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
    billCol: { flex: 0.8, alignItems: "center", justifyContent: "center" },
    billText: { fontSize: 11, color: "#374151", textAlign: "center" },
    bookedCol: { flex: 1, alignItems: "center", justifyContent: "center" },
    bookedText: { fontSize: 11, color: "#374151", textAlign: "center" },
    deleteCol: { width: 24, alignItems: "flex-end", justifyContent: "center" },
});

const headerStyles = StyleSheet.create({
    row: { flexDirection: "row", backgroundColor: "rgba(243,244,246,0.8)", borderBottomWidth: 1, borderBottomColor: "#e5e7eb", paddingHorizontal: 10, paddingVertical: 10 },
    col: { flex: 1, alignItems: "center" },
    countCol: { flex: 0.6, alignItems: "center" },
    billCol: { flex: 0.8, alignItems: "center" },
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
        <View style={rowStyles.billCol}>
            <Text style={rowStyles.billText}>{item.bill_number}</Text>
        </View>
        <View style={rowStyles.bookedCol}>
            <Text numberOfLines={1} style={rowStyles.bookedText}>{item.booked_by_name}</Text>
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
    const { selectedDraw } = useDrawStore();
    const { user } = useAuthStore();
    const queryClient = useQueryClient();
    const params = useLocalSearchParams();
    const billNumber = params.bill_number as string | undefined;

    const [search, setSearch] = useState(billNumber || "");
    const [debouncedSearch, setDebouncedSearch] = useState(billNumber || "");
    const [selectedType, setSelectedType] = useState("");
    const [selectedSubType, setSelectedSubType] = useState("");
    const [filtersOpen, setFiltersOpen] = useState(true);

    const isSuperuser = !!user?.superuser;

    useEffect(() => {
        const handle = setTimeout(() => setDebouncedSearch(search.trim()), 300);
        return () => clearTimeout(handle);
    }, [search]);

    const buildQuery = useCallback((page: number = 1) => {
        const p: Record<string, string> = {};
        if (selectedDraw?.id) p["draw_session__draw__id"] = String(selectedDraw.id);
        if (debouncedSearch) p["search"] = debouncedSearch;
        if (selectedType) p["type"] = selectedType;
        if (selectedSubType) p["sub_type"] = selectedSubType;
        p["page"] = String(page);

        return Object.keys(p)
            .map(key => encodeURIComponent(key) + "=" + encodeURIComponent(p[key]))
            .join("&");
    }, [selectedDraw, debouncedSearch, selectedType, selectedSubType]);

    const filterKeys = [selectedDraw?.id, debouncedSearch, selectedType, selectedSubType];

    const {
        data: infiniteData,
        isLoading,
        error,
        refetch,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
    } = useInfiniteQuery<BookingDetailsResponse>({
        queryKey: ["booking-details", ...filterKeys],
        queryFn: ({ pageParam = 1 }) =>
            api.get<BookingDetailsResponse>(`/draw-booking/booking-details/?${buildQuery(pageParam as number)}`).then(res => res.data),
        initialPageParam: 1,
        getNextPageParam: (lastPage) => lastPage.next,
        enabled: !!selectedDraw?.id,
    });

    // Prefetch next page
    useEffect(() => {
        if (infiniteData && hasNextPage && !isFetchingNextPage) {
            fetchNextPage();
        }
    }, [infiniteData?.pages.length, hasNextPage, isFetchingNextPage]);

    const totalCount = infiniteData?.pages[0]?.total_count ?? 0;
    const totalAmount = infiniteData?.pages[0]?.total_amount ?? 0;

    const displayRows = useMemo(() => {
        if (!infiniteData?.pages) return [];
        const allItems: BookingDetail[] = [];
        for (const page of infiniteData.pages) {
            if (page.results) allItems.push(...page.results);
        }
        return prepareDisplayRows(allItems);
    }, [infiniteData?.pages]);

    const shouldShowTotalFooter = !!selectedDraw?.id && !isLoading && !error && displayRows.length > 0;

    const handleEndReached = useCallback(() => {
        if (hasNextPage && !isFetchingNextPage) fetchNextPage();
    }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

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
                            queryClient.invalidateQueries({ queryKey: ["booking-details"] });
                            queryClient.invalidateQueries({ queryKey: ["bookings"] });
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
                {/* Filters toggle */}
                <TouchableOpacity
                    onPress={() => setFiltersOpen(prev => !prev)}
                    className="flex-row items-center justify-between py-2 px-1 mb-1"
                    activeOpacity={0.7}
                >
                    <Text className="text-sm font-semibold text-gray-700">Filters</Text>
                    <Ionicons name={filtersOpen ? "chevron-up" : "chevron-down"} size={18} color="#6b7280" />
                </TouchableOpacity>
                {filtersOpen && <View className="gap-3 mb-3">


                    <View className="flex-row gap-3">
                        <View className="flex-1">
                            <Dropdown
                                data={typeOptions}
                                labelField="label"
                                valueField="value"
                                value={selectedType}
                                onChange={item => setSelectedType(item.value)}
                                placeholder="Type"
                                style={{ borderColor: "#9ca3af", borderWidth: 1, borderRadius: 6, paddingHorizontal: 8, padding: 10 }}
                                containerStyle={{ borderRadius: 6 }}
                                itemTextStyle={{ color: "#000" }}
                                selectedTextStyle={{ color: "#000" }}
                                renderRightIcon={() =>
                                    selectedType ? (
                                        <TouchableOpacity
                                            onPress={() => setSelectedType("")}
                                            style={{ position: "absolute", right: 10, zIndex: 10, backgroundColor: "#fff", width: 24, height: 24, alignItems: "center", justifyContent: "center", borderRadius: 12 }}
                                        >
                                            <Text style={{ color: "#9ca3af", fontSize: 18 }}>✕</Text>
                                        </TouchableOpacity>
                                    ) : null
                                }
                            />
                        </View>
                        <View className="flex-1">
                            <Dropdown
                                data={subTypeOptions}
                                labelField="label"
                                valueField="value"
                                value={selectedSubType}
                                onChange={item => setSelectedSubType(item.value)}
                                placeholder="Sub Type"
                                style={{ borderColor: "#9ca3af", borderWidth: 1, borderRadius: 6, paddingHorizontal: 8, padding: 10 }}
                                containerStyle={{ borderRadius: 6 }}
                                itemTextStyle={{ color: "#000" }}
                                selectedTextStyle={{ color: "#000" }}
                                renderRightIcon={() =>
                                    selectedSubType ? (
                                        <TouchableOpacity
                                            onPress={() => setSelectedSubType("")}
                                            style={{ position: "absolute", right: 10, zIndex: 10, backgroundColor: "#fff", width: 24, height: 24, alignItems: "center", justifyContent: "center", borderRadius: 12 }}
                                        >
                                            <Text style={{ color: "#9ca3af", fontSize: 18 }}>✕</Text>
                                        </TouchableOpacity>
                                    ) : null
                                }
                            />
                        </View>
                    </View>
                </View>}

                {/* Main Content */}
                {!selectedDraw?.id ? (
                    <View className="flex-1 justify-center items-center">
                        <Text className="text-base text-gray-500">No draw selected.</Text>
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
                                <View style={headerStyles.billCol}>
                                    <Text style={headerStyles.text}>BILL</Text>
                                </View>
                                <View style={headerStyles.col}>
                                    <Text style={headerStyles.text}>BOOKED</Text>
                                </View>
                                {isSuperuser && <View style={headerStyles.deleteCol} />}
                            </View>
                            <FlashList
                                data={displayRows}
                                keyExtractor={keyExtractor}
                                renderItem={renderItem}
                                estimatedItemSize={ROW_HEIGHT}
                                overrideItemLayout={overrideItemLayout}
                                drawDistance={ROW_HEIGHT * 50}
                                onEndReached={handleEndReached}
                                onEndReachedThreshold={0.5}
                                ListFooterComponent={
                                    isFetchingNextPage ? (
                                        <View style={footerStyle}>
                                            <ActivityIndicator size="small" color="#7c3aed" />
                                        </View>
                                    ) : null
                                }
                                ListEmptyComponent={emptyComponent}
                                refreshing={false}
                                onRefresh={() => refetch()}
                            />
                        </View>

                        {shouldShowTotalFooter && (
                            <View className="border-t border-gray-200 py-3 bg-gray-100 px-4 mt-4 rounded-lg">
                                <View className="flex-row">
                                    <Text className="flex-1 font-bold text-sm text-gray-800">TOTAL</Text>
                                    <Text className="flex-1 text-sm text-center font-semibold text-gray-700">
                                        {totalCount}
                                    </Text>
                                    <Text className="flex-1 text-sm text-right font-semibold text-violet-700">
                                        ₹{amountHandler(Number(totalAmount))}
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
