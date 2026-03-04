import { useAuthStore } from "@/store/auth";
import useDrawStore from "@/store/draw";
import api from "@/utils/axios";
import { getToday, getTommorow } from "@/utils/date";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    FlatList,
    StyleSheet,
    Switch,
    Text,
    TouchableOpacity,
    View
} from "react-native";
import { Dropdown } from "react-native-element-dropdown";
import { SafeAreaView } from "react-native-safe-area-context";
import { Agent } from "./(tabs)/agent";

type WinnerReport = {
    customer_name: string;
    bill_number: number;
    prize: number;
    win_number: string;
    count: string;
    lsk: string;
    draw: string;
    dealer: string;
    agent: string | null;
    booking_datetime?: string;
};

// Pre-computed display row to avoid expensive formatting during scroll
type DisplayRow = {
    key: string;
    date: string;
    time: string;
    win_number: string;
    lsk: string;
    count: string;
    dealer: string;
    customer_name: string;
    agent: string | null;
    prize: string;
};

type OptimizedResult = {
    count: number;
    total_pages: number;
    next: number | null;
    previous: number | null;
    results: {
        data: WinnerReport[];
        total_winning_prize: number;
    };
};

function formatDateToDDMMYYYY(date: Date | string | undefined | null): string {
    if (!date) return "";
    let d: Date;
    if (typeof date === "string") {
        d = new Date(date);
    } else {
        d = date;
    }
    if (isNaN(d.getTime())) return "";
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
}

// Pre-compute all display strings once when data arrives
function prepareDisplayRows(items: WinnerReport[], keyOffset: number = 0): DisplayRow[] {
    return items.map((item, i) => {
        let date = "";
        let time = "";
        if (item.booking_datetime) {
            const d = new Date(item.booking_datetime);
            if (!isNaN(d.getTime())) {
                date = formatDateToDDMMYYYY(d);
                time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            }
        }
        return {
            key: String(keyOffset + i),
            date,
            time,
            win_number: item.win_number,
            lsk: item.lsk,
            count: item.count,
            dealer: item.dealer,
            customer_name: item.customer_name,
            agent: item.agent,
            prize: `₹${Number(item.prize).toLocaleString()}`,
        };
    });
}

const ROW_HEIGHT = 60;

const rowStyles = StyleSheet.create({
    rowEven: { height: ROW_HEIGHT, flexDirection: "row", alignItems: "center", paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: "#f3f4f6", backgroundColor: "#fff" },
    rowOdd: { height: ROW_HEIGHT, flexDirection: "row", alignItems: "center", paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: "#f3f4f6", backgroundColor: "#f9fafb" },
    dateCol: { flex: 1.1 },
    dateText: { fontSize: 11, color: "#374151", fontWeight: "600" },
    timeText: { fontSize: 10, color: "#6b7280" },
    numCol: { flex: 1, alignItems: "center" },
    winNum: { fontSize: 14, color: "#047857", fontWeight: "700", letterSpacing: 2, textAlign: "center" },
    lsk: { fontSize: 11, color: "#6b7280", textAlign: "center" },
    countText: { fontSize: 10, color: "#9ca3af", textAlign: "center" },
    countBold: { fontWeight: "600" },
    dealerCol: { flex: 1, alignItems: "center" },
    dealerText: { fontSize: 11, color: "#374151", fontWeight: "600", textAlign: "center" },
    customerText: { fontSize: 11, color: "#047857", textAlign: "center" },
    agentText: { fontSize: 10, color: "#9ca3af", textAlign: "center" },
    prizeCol: { flex: 1, alignItems: "flex-end" },
    prizeText: { fontSize: 13, color: "#6d28d9", fontWeight: "700", textAlign: "center", width: "100%" },
});

const headerStyles = StyleSheet.create({
    row: { flexDirection: "row", backgroundColor: "rgba(243,244,246,0.8)", borderBottomWidth: 1, borderBottomColor: "#e5e7eb", paddingHorizontal: 16, paddingVertical: 10 },
    dateCol: { flex: 1.1 },
    col: { flex: 1, alignItems: "center" },
    text: { fontSize: 11, fontWeight: "600", color: "#4b5563", textTransform: "uppercase" },
    textCenter: { fontSize: 11, fontWeight: "600", color: "#4b5563", textTransform: "uppercase", textAlign: "center" },
    activeText: { color: "#7c3aed" },
});

const footerStyle = { paddingVertical: 12, alignItems: "center" as const };
const emptyComponent = (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center", paddingVertical: 64 }}>
        <Text style={{ color: "#6b7280", fontSize: 14 }}>No Winner's data available.</Text>
    </View>
);

const WinnerRow = React.memo(({ item, index }: { item: DisplayRow; index: number }) => (
    <View style={index % 2 === 0 ? rowStyles.rowEven : rowStyles.rowOdd}>
        <View style={rowStyles.dateCol}>
            {item.date ? (
                <>
                    <Text style={rowStyles.dateText}>{item.date}</Text>
                    <Text style={rowStyles.timeText}>{item.time}</Text>
                </>
            ) : null}
        </View>
        <View style={rowStyles.numCol}>
            <Text style={rowStyles.winNum}>{item.win_number}</Text>
            <Text style={rowStyles.lsk}>{item.lsk}</Text>
            <Text style={rowStyles.countText}>
                Count: <Text style={rowStyles.countBold}>{item.count}</Text>
            </Text>
        </View>
        <View style={rowStyles.dealerCol}>
            <Text style={rowStyles.dealerText}>{item.dealer}</Text>
            {item.customer_name ? (
                <Text numberOfLines={1} style={rowStyles.customerText}>{item.customer_name}</Text>
            ) : null}
            {item.agent ? (
                <Text style={rowStyles.agentText}>Agent: {item.agent}</Text>
            ) : null}
        </View>
        <View style={rowStyles.prizeCol}>
            <Text style={rowStyles.prizeText}>{item.prize}</Text>
        </View>
    </View>
));

const WinnersReportScreen = () => {
    const { selectedDraw } = useDrawStore();
    const [search, setSearch] = useState("");
    const [fromDate, setFromDate] = useState<Date>(getToday());
    const [toDate, setToDate] = useState<Date>(getTommorow());
    const [showFromPicker, setShowFromPicker] = useState(false);
    const [showToPicker, setShowToPicker] = useState(false);
    const [allGame, setAllGame] = useState(false);
    const [selectedAgent, setSelectedAgent] = useState("");
    const [selectedDealer, setSelectedDealer] = useState("");
    const [ordering, setOrdering] = useState<string>("");

    const { user, token } = useAuthStore();
    
    // QueryClient for caching
    const queryClient = useQueryClient();
    const cachedAgents = queryClient.getQueryData<Agent[]>(["agents"]);
    const cachedDealers = queryClient.getQueryData<Agent[]>(["dealers"]);

    // Fetch agents if user is DEALER
    const {
        data: agents = [],
        isLoading: isAgentLoading,
    } = useQuery<Agent[]>({
        queryKey: ["agents"],
        queryFn: () => api.get("/agent/manage/").then((res) => res.data),
        enabled: user?.user_type === "DEALER" && !cachedAgents,
        initialData: user?.user_type === "DEALER" ? cachedAgents : undefined,
    });

    // Fetch dealers if user is ADMIN
    const {
        data: dealers = [],
        isLoading: isDealerLoading,
    } = useQuery<Agent[]>({
        queryKey: ["dealers"],
        queryFn: () => api.get("/administrator/dealer/").then((res) => res.data),
        enabled: user?.user_type === "ADMIN" && !cachedDealers,
        initialData: user?.user_type === "ADMIN" ? cachedDealers : undefined,
    });

    // Build query params for optimized endpoint
    const buildQuery = (page: number = 1) => {
        const params: Record<string, string> = {};
        if (fromDate) params["date_time__gte"] = fromDate.toISOString();
        if (toDate) params["date_time__lte"] = toDate.toISOString();
        if (user?.user_type === "DEALER" && selectedAgent)
            params["booked_agent__id"] = selectedAgent;
        if (user?.user_type === "ADMIN" && selectedDealer)
            params["booked_dealer__id"] = selectedDealer;
        if (selectedDraw?.id && !allGame) params["booking_detail__booking__draw_session__draw__id"] = String(selectedDraw.id);
        if (ordering) params["ordering"] = ordering;
        params["page"] = String(page);

        return Object.keys(params)
            .map(key => encodeURIComponent(key) + "=" + encodeURIComponent(params[key]))
            .join("&");
    };

    const filterKeys = [
        fromDate?.toISOString(),
        toDate?.toISOString(),
        allGame,
        selectedDraw?.id,
        selectedAgent,
        selectedDealer,
        ordering,
    ];

    // Infinite query for paginated data
    const {
        data: infiniteData,
        isLoading,
        error,
        refetch,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
    } = useInfiniteQuery<OptimizedResult>({
        queryKey: ["optimized-winners", ...filterKeys],
        queryFn: ({ pageParam = 1 }) =>
            api.get<OptimizedResult>(`/draw-result/optimized-winners/?${buildQuery(pageParam as number)}`).then((res) => res.data),
        initialPageParam: 1,
        getNextPageParam: (lastPage) => lastPage.next,
        enabled: !!selectedDraw?.id,
    });

    // Prefetch next page as soon as current page loads
    useEffect(() => {
        if (infiniteData && hasNextPage && !isFetchingNextPage) {
            fetchNextPage();
        }
    }, [infiniteData?.pages.length, hasNextPage, isFetchingNextPage]);

    const totalAmount = infiniteData?.pages[0]?.results?.total_winning_prize || 0;

    // Flatten all pages into pre-computed display rows
    const displayRows = useMemo(() => {
        if (!infiniteData?.pages) return [];
        const allItems: WinnerReport[] = [];
        for (const page of infiniteData.pages) {
            if (page.results?.data) allItems.push(...page.results.data);
        }
        const filtered = search
            ? allItems.filter(item => item.bill_number?.toString().includes(search))
            : allItems;
        return prepareDisplayRows(filtered);
    }, [infiniteData?.pages, search]);

    const shouldShowTotalFooter = !!selectedDraw?.id && !isLoading && !error && displayRows.length > 0;

    const renderItem = useCallback(({ item, index }: { item: DisplayRow; index: number }) => (
        <WinnerRow item={item} index={index} />
    ), []);

    const keyExtractor = useCallback((item: DisplayRow) => item.key, []);

    const getItemLayout = useCallback((_: any, index: number) => ({
        length: ROW_HEIGHT,
        offset: ROW_HEIGHT * index,
        index,
    }), []);

    // Trigger next page fetch when user scrolls near the end
    const handleEndReached = useCallback(() => {
        if (hasNextPage && !isFetchingNextPage) {
            fetchNextPage();
        }
    }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

    // Toggle ordering: none -> asc -> desc -> none
    const toggleOrdering = useCallback((field: string) => {
        setOrdering(prev => {
            if (prev === field) return `-${field}`;
            if (prev === `-${field}`) return "";
            return field;
        });
    }, []);

    const getArrow = useCallback((field: string) => {
        if (ordering === field) return " \u2191";
        if (ordering === `-${field}`) return " \u2193";
        return "";
    }, [ordering]);

    return (
        <SafeAreaView className="flex-1 bg-white">
            <View className="flex-1 p-4">
                {/* Filters */}
                <View className="gap-3 mb-3">
                    {/* <TextInput
                        placeholder="Search by Bill No."
                        value={search}
                        keyboardType="numeric"
                        onChangeText={setSearch}
                        className="border border-gray-300 rounded-lg px-4 py-3 text-base focus:border-violet-500"
                        placeholderTextColor="#9ca3af"
                    /> */}

                    <View className="flex-row gap-3">
                        <TouchableOpacity
                            onPress={() => setShowFromPicker(true)}
                            className="flex-1 border border-gray-300 rounded-lg px-4 py-3 active:bg-gray-50"
                        >
                            <Text className="text-gray-700">
                                From:{" "}
                                <Text
                                    className={fromDate ? "text-gray-900 font-medium" : "text-gray-500"}
                                >
                                    {formatDateToDDMMYYYY(fromDate) || "Select Date"}
                                </Text>
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => setShowToPicker(true)}
                            className="flex-1 border border-gray-300 rounded-lg px-4 py-3 active:bg-gray-50"
                        >
                            <Text className="text-gray-700">
                                To:{" "}
                                <Text
                                    className={toDate ? "text-gray-900 font-medium" : "text-gray-500"}
                                >
                                    {formatDateToDDMMYYYY(toDate) || "Select Date"}
                                </Text>
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {/* Show agent/dealer filter only for DEALER or ADMIN */}
                    {user?.user_type === "DEALER" && (
                        <Dropdown
                            data={agents.map((agent) => ({
                                label: agent.username,
                                value: agent.id,
                            }))}
                            labelField="label"
                            valueField="value"
                            value={selectedAgent}
                            onChange={item => setSelectedAgent(item.value)}
                            placeholder="Select Agent"
                            style={{
                                borderColor: "#9ca3af",
                                borderWidth: 1,
                                borderRadius: 6,
                                paddingHorizontal: 8,
                                padding: 10
                            }}
                            containerStyle={{
                                borderRadius: 6,
                            }}
                            itemTextStyle={{
                                color: "#000",
                            }}
                            selectedTextStyle={{
                                color: "#000",
                            }}
                            renderRightIcon={() =>
                                selectedAgent ? (
                                    <TouchableOpacity
                                        onPress={() => setSelectedAgent("")}
                                        style={{
                                            position: "absolute",
                                            right: 10,
                                            zIndex: 10,
                                            backgroundColor: "#fff",
                                            width: 24,
                                            height: 24,
                                            alignItems: "center",
                                            justifyContent: "center",
                                            borderRadius: 12,
                                        }}
                                    >
                                        <Text style={{ color: "#9ca3af", fontSize: 18 }}>✕</Text>
                                    </TouchableOpacity>
                                ) : null
                            }
                        />
                    )}
                    {user?.user_type === "ADMIN" && (
                        <Dropdown
                            data={dealers.map((dealer) => ({
                                label: dealer.username,
                                value: dealer.id,
                            }))}
                            labelField="label"
                            valueField="value"
                            value={selectedDealer}
                            onChange={item => setSelectedDealer(item.value)}
                            placeholder="Select Dealer"
                            style={{
                                borderColor: "#9ca3af",
                                borderWidth: 1,
                                borderRadius: 6,
                                paddingHorizontal: 8,
                                padding: 10
                            }}
                            containerStyle={{
                                borderRadius: 6,
                            }}
                            itemTextStyle={{
                                color: "#000",
                            }}
                            selectedTextStyle={{
                                color: "#000",
                            }}
                            renderRightIcon={() =>
                                selectedDealer ? (
                                    <TouchableOpacity
                                        onPress={() => setSelectedDealer("")}
                                        style={{
                                            position: "absolute",
                                            right: 10,
                                            zIndex: 10,
                                            backgroundColor: "#fff",
                                            width: 24,
                                            height: 24,
                                            alignItems: "center",
                                            justifyContent: "center",
                                            borderRadius: 12,
                                        }}
                                    >
                                        <Text style={{ color: "#9ca3af", fontSize: 18 }}>✕</Text>
                                    </TouchableOpacity>
                                ) : null
                            }
                        />
                    )}

                    <View className="flex-row items-center justify-between px-1 pt-1">
                        <Text className="text-sm text-gray-700">All Game</Text>
                        <Switch
                            value={allGame}
                            onValueChange={setAllGame}
                            trackColor={{ false: "#e5e7eb", true: "#a78bfa" }}
                            thumbColor={allGame ? "#7c3aed" : "#f4f3f4"}
                            ios_backgroundColor="#e5e7eb"
                        />
                    </View>
                </View>

                {/* --- Main Content Area --- */}
                {!selectedDraw?.id ? (
                    <View className="flex-1 justify-center items-center">
                        <Text className="text-base text-gray-500">
                            No draw selected. Please choose one.
                        </Text>
                    </View>
                ) : isLoading ? (
                    <View className="flex-1 justify-center items-center">
                        <View className="bg-white rounded-xl px-6 py-8 shadow-md border border-gray-200 items-center">
                            <ActivityIndicator size="large" color="#7c3aed" />
                            <Text className="mt-4 text-lg font-semibold text-violet-700">Loading Winners Data...</Text>
                            <Text className="mt-1 text-gray-500 text-base">Please wait while we fetch the latest results.</Text>
                        </View>
                    </View>
                ) : error ? (
                    <View className="flex-1 justify-center items-center">
                        <View className="bg-red-50 border border-red-200 px-6 py-8 rounded-xl items-center shadow">
                            <Text className="text-2xl mb-2">😢</Text>
                            <Text className="text-red-700 font-bold text-lg mb-1">
                                Error loading report
                            </Text>
                            <Text className="text-red-600 text-base mb-3">
                                There was a problem fetching the winners data.
                            </Text>
                            <TouchableOpacity
                                onPress={() => refetch()}
                                className="bg-violet-600 px-4 py-2 rounded-lg"
                            >
                                <Text className="text-white font-semibold">Retry</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                ) : (
                    <>
                        <View className="flex-1 rounded-2xl bg-white shadow-sm border border-gray-200 overflow-hidden">
                            {/* Header outside FlatList so getItemLayout stays accurate */}
                            <View style={headerStyles.row}>
                                <TouchableOpacity
                                    style={headerStyles.dateCol}
                                    onPress={() => toggleOrdering("booking_detail__booking__date_time")}
                                    activeOpacity={0.6}
                                >
                                    <Text style={[
                                        headerStyles.text,
                                        ordering.includes("date_time") && headerStyles.activeText
                                    ]}>
                                        DATE{getArrow("booking_detail__booking__date_time")}
                                    </Text>
                                </TouchableOpacity>
                                <View style={headerStyles.col}>
                                    <Text style={headerStyles.text}>NUMBER</Text>
                                </View>
                                <View style={headerStyles.col}>
                                    <Text style={headerStyles.text}>DEALER</Text>
                                </View>
                                <TouchableOpacity
                                    style={headerStyles.col}
                                    onPress={() => toggleOrdering("prize")}
                                    activeOpacity={0.6}
                                >
                                    <Text style={[
                                        headerStyles.textCenter,
                                        ordering.includes("prize") && headerStyles.activeText
                                    ]}>
                                        PRIZE{getArrow("prize")}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                            <FlatList
                                data={displayRows}
                                keyExtractor={keyExtractor}
                                renderItem={renderItem}
                                initialNumToRender={30}
                                maxToRenderPerBatch={100}
                                updateCellsBatchingPeriod={16}
                                windowSize={21}
                                removeClippedSubviews={true}
                                getItemLayout={getItemLayout}
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
                                    <Text className="flex-1 text-sm text-right font-semibold text-emerald-700">
                                        ₹{totalAmount}
                                    </Text>
                                </View>
                            </View>
                        )}
                    </>
                )}

                {showFromPicker && (
                    <DateTimePicker
                        mode="date"
                        value={fromDate || new Date()}
                        onChange={(event, date) => {
                            if (date) setFromDate(date);
                            setShowFromPicker(false);
                        }}
                    />
                )}
                {showToPicker && (
                    <DateTimePicker
                        mode="date"
                        value={toDate || new Date()}
                        onChange={(event, date) => {
                            if (date) setToDate(date);
                            setShowToPicker(false);
                        }}
                    />
                )}
            </View>
        </SafeAreaView>
    );
};

export default WinnersReportScreen;