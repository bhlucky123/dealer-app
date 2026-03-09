import { useAuthStore } from "@/store/auth";
import useDrawStore from "@/store/draw";
import { amountHandler } from "@/utils/amount";
import api from "@/utils/axios";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as FileSystem from 'expo-file-system';
import { printToFileAsync } from 'expo-print';
import { useRouter } from "expo-router";
import { shareAsync } from "expo-sharing";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Switch,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from "react-native";
import { Dropdown } from "react-native-element-dropdown";
import { SafeAreaView } from "react-native-safe-area-context";
import { Agent } from "./(tabs)/agent";

// --- Memoized Row Component for FlatList performance ---
const ROW_HEIGHT = 58;

const SalesRow = React.memo(({ item, index, userType, isSuperuser, onPress, onDelete }: {
    item: any; index: number; userType: string | undefined; isSuperuser: boolean;
    onPress: (item: any) => void; onDelete: (item: any) => void;
}) => (
    <TouchableOpacity
        className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}
        activeOpacity={0.7}
        onPress={() => onPress(item)}
    >
        <View className="flex-row px-4 py-3 items-center border-b border-gray-100">
            <View className="flex-[1.1] flex-col justify-center">
                <Text className="text-[10px] text-gray-800 font-medium">{formatDate(new Date(item.date_time))}</Text>
                <Text className="text-[9px] text-gray-500 mt-0.5">
                    {new Date(item.date_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true })}
                </Text>
            </View>
            {userType !== 'AGENT' && (
                <View className="flex-[1.2]">
                    <Text className="flex-[1.2] text-sm text-center text-gray-700" numberOfLines={1} ellipsizeMode="tail" style={{ minWidth: 0 }}>
                        {item.booked_by_name}
                    </Text>
                    {item?.booked_by_type && (
                        <Text className="text-xs text-center text-violet-700" numberOfLines={1} ellipsizeMode="tail" style={{ minWidth: 0 }}>
                            {item.booked_by_type}
                        </Text>
                    )}
                    {item?.customer_name && (
                        <Text className="text-xs text-center text-emerald-700" numberOfLines={1} ellipsizeMode="tail" style={{ minWidth: 0 }}>
                            {item?.customer_name}
                        </Text>
                    )}
                </View>
            )}
            <Text className="flex-1 text-sm text-center text-gray-700">{item.bill_number}</Text>
            <Text className="flex-1 text-sm text-center text-gray-700">{item.total_booking_count}</Text>
            <Text className="flex-1 text-sm text-right text-violet-700 font-semibold">₹{amountHandler(Number(userType === 'AGENT' ? item.calculated_agent_amount : item.calculated_dealer_amount))}</Text>
            <Text className="flex-1 text-sm text-right text-emerald-700 font-semibold">₹{amountHandler(Number(item.total_booking_amount))}</Text>
            {isSuperuser && (
                <View className="w-4 items-end">
                    <TouchableOpacity onPress={() => onDelete(item)} hitSlop={10}>
                        <Ionicons name="trash-outline" size={17} color="#ef4444" />
                    </TouchableOpacity>
                </View>
            )}
        </View>
    </TouchableOpacity>
));

// Always use local time for today (midnight)
const getToday = () => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
};

// Tomorrow at midnight (start of next day)
const getTomorrow = () => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
};

// Format date as DD/MM/YYYY in local time
const formatDateDDMMYYYY = (date?: Date | null) => {
    if (!date) return "";
    // Use local time
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
};


const formatDate = (date?: Date | null) => {
    if (!date) return "";
    // Short format: DD/MM/YY
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = String(d.getFullYear()).slice(-2);
    return `${day}/${month}/${year}`;
};

// Helper for filename: format as YYYYMMDD
const formatDateYYYYMMDD = (date?: Date | null) => {
    if (!date) return "";
    // Use local time
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}${month}${day}`;
};

// Helper to get a unique key for a bill (for FlatList)
const getBillKey = (item: any) => {
    if (item.id !== undefined && item.id !== null && item.bill_number !== undefined && item.bill_number !== null) {
        return `id_${item.id}_bill_${item.bill_number}`;
    }
    if (item.id !== undefined && item.id !== null) return `id_${item.id}`;
    if (item.bill_number !== undefined && item.bill_number !== null) return `bill_${item.bill_number}`;
    if (item.date_time) return `dt_${item.date_time}_${Math.random()}`;
    return Math.random().toString(36).slice(2);
};



const SalesReportScreen = () => {
    const { selectedDraw } = useDrawStore();
    const [search, setSearch] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    // Use local time for initial dates
    const [fromDate, setFromDate] = useState<Date | null>(getToday());
    const [toDate, setToDate] = useState<Date | null>(getTomorrow());
    const [showFromPicker, setShowFromPicker] = useState(false);
    const [showToPicker, setShowToPicker] = useState(false);

    const [allGame, setAllGame] = useState(false);
    const [selectedFilter, setSelectedFilter] = useState("");
    const [printing, setPrinting] = useState(false);
    const [filtersOpen, setFiltersOpen] = useState(true);

    // Pagination state
    const [page, setPage] = useState(1);
    const [allData, setAllData] = useState<any[]>([]);
    const [isFetchingMore, setIsFetchingMore] = useState(false);
    const [totalPages, setTotalPages] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const [totalBillCount, setTotalBillCount] = useState(0);
    const [totalDealerAmount, setTotalDealerAmount] = useState(0);
    const [totalAgentAmount, setTotalAgentAmount] = useState(0);
    const [totalCustomerAmount, setTotalCustomerAmount] = useState(0);

    const { user } = useAuthStore();
    const router = useRouter();
    const queryClient = useQueryClient();
    const cachedAgents = queryClient.getQueryData<Agent[]>(["agents"]);
    const cachedDealers = queryClient.getQueryData<Agent[]>(["dealers"]);

    const { data: agents = [] } = useQuery<Agent[]>({
        queryKey: ["agents"],
        queryFn: () => api.get("/agent/manage/").then((res) => res.data),
        enabled: user?.user_type === "DEALER" && !cachedAgents,
        initialData: user?.user_type === "DEALER" ? cachedAgents : undefined,
    });

    const { data: dealers = [] } = useQuery<Agent[]>({
        queryKey: ["dealers"],
        queryFn: () => api.get("/administrator/dealer/").then((res) => res.data),
        enabled: user?.user_type === "ADMIN" && !cachedDealers,
        initialData: user?.user_type === "ADMIN" ? cachedDealers : undefined,
    });

    // Debounce search input
    useEffect(() => {
        const handle = setTimeout(() => setDebouncedSearch(search.trim()), 300);
        return () => clearTimeout(handle);
    }, [search]);

    // Build query string for API
    const buildQuery = useCallback((pageNum = 1) => {
        const params: Record<string, string> = {};

        if (fromDate) {
            const year = fromDate.getFullYear();
            const month = String(fromDate.getMonth() + 1).padStart(2, "0");
            const day = String(fromDate.getDate()).padStart(2, "0");
            params["date_time__gte"] = `${year}-${month}-${day}`;
        }
        if (toDate) {
            const year = toDate.getFullYear();
            const month = String(toDate.getMonth() + 1).padStart(2, "0");
            const day = String(toDate.getDate()).padStart(2, "0");
            params["date_time__lte"] = `${year}-${month}-${day}`;
        }
        if (debouncedSearch) params["search"] = debouncedSearch;
        if (selectedDraw?.id && !allGame) params["draw_session__draw__id"] = String(selectedDraw.id);

        if (user?.user_type === "ADMIN" && selectedFilter) {
            params["booked_dealer__id"] = selectedFilter;
        }
        if (user?.user_type === "DEALER" && selectedFilter) {
            params["booked_agent__id"] = selectedFilter;
        }
        params["page"] = String(pageNum);

        return Object.keys(params)
            .map(key => encodeURIComponent(key) + "=" + encodeURIComponent(params[key]))
            .join("&");
    }, [fromDate, toDate, selectedDraw, allGame, user?.user_type, selectedFilter, debouncedSearch]);

    // Reset on filter change
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const filterDeps = [fromDate, toDate, selectedDraw?.id, allGame, user?.user_type, selectedFilter, debouncedSearch];
    useMemo(() => {
        setPage(1);
        setAllData([]);
        // eslint-disable-next-line
    }, filterDeps);

    // Fetch first page
    const {
        data,
        isLoading,
        error,
        refetch,
        isFetching,
    } = useQuery<any>({
        queryKey: ["/draw-booking/booking-report/", buildQuery()],
        queryFn: async () => {
            const res = await api.get(`/draw-booking/booking-report/?${buildQuery()}`);
            return res.data;
        },
        enabled: !!selectedDraw?.id,
    });

    // Sync first page data
    useMemo(() => {
        if (!data) return;
        setAllData(data.results || []);
        setPage(1);
        setTotalPages(data.total_pages || 1);
        setTotalCount(data.count || 0);
        setTotalBillCount(data.total_bill_count ?? 0);
        setTotalDealerAmount(data.total_dealer_amount ?? 0);
        setTotalAgentAmount(data.total_agent_amount ?? 0);
        setTotalCustomerAmount(data.total_customer_amount ?? 0);
        // eslint-disable-next-line
    }, [data]);

    const hasMore = page < totalPages;
    const shouldShowTotalFooter = !!selectedDraw?.id && !isLoading && !error && allData.length > 0;

    // Use ref to guard against multiple simultaneous onEndReached calls
    const loadingMoreRef = useRef(false);

    const handleLoadMore = useCallback(async () => {
        if (loadingMoreRef.current || isLoading || !hasMore) return;
        loadingMoreRef.current = true;
        setIsFetchingMore(true);
        try {
            const nextPage = page + 1;
            const res = await api.get(`/draw-booking/booking-report/?${buildQuery(nextPage)}`);
            const newResults = res.data.results || [];

            setAllData(prev => {
                const prevKeys = new Set(prev.map(getBillKey));
                const unique = newResults.filter((item: any) => !prevKeys.has(getBillKey(item)));
                return [...prev, ...unique];
            });
            setPage(nextPage);
            setTotalPages(res.data.total_pages || totalPages);
        } catch (err) {
            // silently fail
        } finally {
            loadingMoreRef.current = false;
            setIsFetchingMore(false);
        }
    }, [isLoading, hasMore, page, buildQuery, totalPages]);

    // For PDF, use same local time logic for date filters
    const printBuildQuery = useCallback(() => {
        const params: Record<string, string> = {};

        if (fromDate) {
            const d = new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate(), 0, 0, 0, 0);
            params["date_time__gte"] = d.toISOString();
        }
        if (toDate) {
            const d = new Date(toDate.getFullYear(), toDate.getMonth(), toDate.getDate(), 23, 59, 59, 999);
            params["date_time__lte"] = d.toISOString();
        }
        if (selectedDraw?.id) params["draw_session__draw__id"] = String(selectedDraw.id);

        if (user?.user_type === "ADMIN" && selectedFilter) {
            params["booked_dealer__id"] = selectedFilter;
        }
        if (user?.user_type === "DEALER" && selectedFilter) {
            params["booked_agent__id"] = selectedFilter;
        }

        return Object.keys(params)
            .map(key => encodeURIComponent(key) + "=" + encodeURIComponent(params[key]))
            .join("&");
    }, [fromDate, toDate, selectedDraw, user?.user_type, selectedFilter]);

    // PDF generation: use allData (all loaded pages) if no search, else filteredResult
    const generatePdf = async () => {
        setPrinting(true);
        try {
            const query = printBuildQuery();
            const res = await api.get(`/draw-booking/booking-report/?${query}`);
            const pdfData = res.data.results || [];

            if (!pdfData || pdfData.length === 0) {
                alert("No data available to generate PDF.");
                setPrinting(false);
                return;
            }

            // Fetch booking details for each bill via retrieve endpoint
            const detailsPromises = pdfData.map((bill: any) =>
                api.get(`/draw-booking/booking-report/${bill.bill_number}/`).then(r => r.data).catch(() => null)
            );
            const detailsResults = await Promise.all(detailsPromises);

            const tableRows = detailsResults.flatMap((detail: any) => {
                if (!detail?.booking_details) return '';
                return detail.booking_details.map((d: any) => `
                    <tr>
                        ${(user?.user_type === "ADMIN" || user?.user_type === "DEALER") ?
                        `<td>${detail?.booked_by_name || 'N/A'}</td>` : ""
                    }
                        <td>${detail.bill_number || ''}</td>
                        <td>${d.number}</td>
                        <td>${d.count}</td>
                        <td>${amountHandler(Number(d.customer_amount))}</td>
                    </tr>
                `).join('');
            }).join('');

            const totalAmount = res?.data?.total_customer_amount || 0

            const now = new Date();
            const formattedDate = formatDateDDMMYYYY(fromDate);
            const formattedTime = now.toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
            }).toUpperCase();

            const cleanDrawName = (selectedDraw?.name || "Draw")
                .replace(/[^a-zA-Z0-9]/g, "_")
                .replace(/_+/g, "_")
                .replace(/^_+|_+$/g, "");

            const fromStr = formatDateDDMMYYYY(fromDate);
            const toStr = formatDateDDMMYYYY(toDate);

            const safePdfFileName = `SalesReport_${cleanDrawName}_${fromStr}_to_${toStr}.pdf`.replace(/[\/\\?%*:|"<>]/g, "_");

            const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; font-size: 10px; }
              .header { 
                text-align: center; 
                margin-bottom: 15px; 
                background: linear-gradient(90deg, #6D28D9 0%, #7C3AED 100%);
                padding: 18px 0 10px 0;
                border-radius: 8px 8px 0 0;
                color: #fff;
              }
              .header h1 { 
                font-size: 18px; 
                margin: 0; 
                color: #FFD700;
                letter-spacing: 1px;
                text-shadow: 1px 1px 2px #4B0082;
              }
              .header p { 
                font-size: 12px; 
                margin: 0; 
                color: #E0E7FF;
              }
              table { 
                width: 100%; 
                border-collapse: collapse; 
                margin-top: 10px;
                background: #F3F4F6;
                border-radius: 0 0 8px 8px;
                overflow: hidden;
              }
              th, td { 
                border: 1px solid #A78BFA; 
                padding: 5px; 
                text-align: center; 
              }
              th { 
                font-weight: bold; 
                background: #C7D2FE;
                color: #3730A3;
              }
              .footer { 
                text-align: right; 
                margin-top: 20px; 
                font-size: 12px; 
                font-weight: bold; 
                color: #6D28D9;
              }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>${selectedDraw?.name || ""}</h1>
              <p>${formattedDate}</p>
            </div>
            <table>
              <thead>
                <tr>
                  ${(user?.user_type === "ADMIN" || user?.user_type === "DEALER") ? '<th>Booked By</th>' : ''}
                  <th>Bill Number</th>
                  <th>Number</th>
                  <th>Count</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                ${tableRows}
              </tbody>
            </table>
            <div class="footer">
              <p>Total Amount: ${amountHandler(Number(totalAmount))}</p>
            </div>
          </body>
        </html>
        `;

            const file = await printToFileAsync({
                html: html,
                base64: false,
                width: 595,
                height: 842,
            });

            const newPdfUri = `${FileSystem.cacheDirectory}${safePdfFileName}`;
            let finalPdfUri = file.uri;

            try {
                if (file.uri !== newPdfUri) {
                    await FileSystem.moveAsync({
                        from: file.uri,
                        to: newPdfUri,
                    });
                    finalPdfUri = newPdfUri;
                }
            } catch (moveErr: any) {
                console.log("PDF move error:", moveErr);
                alert("Could not save PDF with the desired filename. The file will be shared with a temporary name.");
            }

            await shareAsync(finalPdfUri, {
                dialogTitle: 'Share Sales Report',
                UTI: 'com.adobe.pdf',
                mimeType: 'application/pdf',
            });
        } catch (err) {
            console.log("PDF generation error:", err);
            alert("An error occurred while creating the PDF.");
        } finally {
            setPrinting(false);
        }
    };

    // Delete a booking (entire bill) with confirmation
    const isSuperuser = !!user?.superuser;

    const handleRowPress = useCallback((item: any) => {
        router.push({ pathname: "/booking-details", params: { bill_number: String(item.bill_number), ...(debouncedSearch ? { search: debouncedSearch } : {}) } });
    }, [router, debouncedSearch]);

    const handleDeleteBooking = (booking: any) => {
        if (!booking?.bill_number) return;
        Alert.alert(
            "Delete Booking",
            `Are you sure you want to delete booking "${booking.bill_number}"? This will remove all booking details under this bill.`,
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            await api.delete(`/draw-booking/delete/${booking.bill_number}/`);
                            // Optimistically remove from local list
                            setAllData(prev => prev.filter((b: any) => b.bill_number !== booking.bill_number));
                            // Refresh server data
                            queryClient.invalidateQueries({ queryKey: ["/draw-booking/booking-report/"] });
                            refetch();
                        } catch (err) {
                            Alert.alert("Delete Failed", "Could not delete booking.");
                        }
                    }
                }
            ]
        );
    };

    const renderItem = useCallback(({ item, index }: { item: any; index: number }) => (
        <SalesRow
            item={item}
            index={index}
            userType={user?.user_type}
            isSuperuser={isSuperuser}
            onPress={handleRowPress}
            onDelete={handleDeleteBooking}
        />
    ), [user?.user_type, isSuperuser, handleRowPress, handleDeleteBooking]);

    const getItemLayout = useCallback((_data: any, index: number) => ({
        length: ROW_HEIGHT,
        offset: ROW_HEIGHT * index,
        index,
    }), []);

    const listHeader = useMemo(() => (
        <View className="flex-row bg-gray-100/80 border-b border-gray-200 px-4 py-3">
            <Text className="flex-[1.1] text-xs font-semibold text-gray-600 uppercase">Date</Text>
            {user?.user_type !== 'AGENT' && (
                <Text className="flex-[1.2] text-xs font-semibold text-center text-gray-600 uppercase">Booked</Text>
            )}
            <Text className="flex-1 text-xs font-semibold text-center text-gray-600 uppercase">Bill No.</Text>
            <Text className="flex-1 text-xs font-semibold text-center text-gray-600 uppercase">Cnt</Text>
            <Text className="flex-1 text-xs font-semibold text-right text-gray-600 uppercase">{user?.user_type === 'AGENT' ? 'D. Amt' : 'Amt'}</Text>
            <Text className="flex-1 text-xs font-semibold text-right text-gray-600 uppercase">C. Amt</Text>
            <Text className="w-1 text-xs font-semibold text-right text-gray-600 uppercase"></Text>
        </View>
    ), [user?.user_type]);

    return (
        <SafeAreaView className="flex-1 bg-white" edges={["bottom"]}>
            <View className="flex-1 p-4">
                {/* Filters */}
                <TouchableOpacity
                    onPress={() => setFiltersOpen(prev => !prev)}
                    className="flex-row items-center justify-between py-3 px-3 mb-1 bg-gray-100 rounded-lg"
                    activeOpacity={0.7}
                >
                    <Text className="text-sm font-semibold text-gray-700">Filters</Text>
                    <View className="w-8 h-8 rounded-full bg-white items-center justify-center shadow-sm" pointerEvents="none">
                        <Ionicons name={filtersOpen ? "chevron-up" : "chevron-down"} size={20} color="#7c3aed" />
                    </View>
                </TouchableOpacity>
                {filtersOpen && <View className="gap-3">
                    <TextInput
                        placeholder="Search..."
                        value={search}
                        keyboardType="numeric"
                        onChangeText={setSearch}
                        className="border border-gray-300 rounded-lg px-4 py-3 text-base focus:border-violet-500"
                        placeholderTextColor="#9ca3af"
                    />

                    <View>
                        <View className="flex-row gap-3">
                            <View className="flex-1">
                                <Text className="text-xs text-gray-500 mb-1">From</Text>
                                <TouchableOpacity
                                    onPress={() => setShowFromPicker(true)}
                                    className="border border-gray-300 rounded-lg px-4 py-3 active:bg-gray-50"
                                >
                                    <Text className={fromDate ? "text-gray-900 font-medium" : "text-gray-500"}>
                                        {fromDate ? formatDateDDMMYYYY(fromDate) : "Select Date"}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                            <View className="flex-1">
                                <Text className="text-xs text-gray-500 mb-1">To</Text>
                                <TouchableOpacity
                                    onPress={() => setShowToPicker(true)}
                                    className="border border-gray-300 rounded-lg px-4 py-3 active:bg-gray-50"
                                >
                                    <Text className={toDate ? "text-gray-900 font-medium" : "text-gray-500"}>
                                        {toDate ? formatDateDDMMYYYY(toDate) : "Select Date"}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>

                    {user?.user_type === "ADMIN" && (
                        <View className="mb-2">
                            <Dropdown
                                data={dealers.map((dealer) => ({
                                    label: dealer.username,
                                    value: dealer.id,
                                }))}
                                labelField="label"
                                valueField="value"
                                value={selectedFilter}
                                onChange={item => {
                                    setSelectedFilter(item.value)
                                }}
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
                                    selectedFilter ? (
                                        <TouchableOpacity
                                            onPress={() => setSelectedFilter("")}
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
                        </View>
                    )}
                    {user?.user_type === "DEALER" && (
                        <View className="mb-2">
                            <Dropdown
                                data={agents.map((agent) => ({
                                    label: agent.username,
                                    value: agent.id,
                                }))}
                                labelField="label"
                                valueField="value"
                                value={selectedFilter}
                                onChange={item => {
                                    setSelectedFilter(item.value)
                                }}
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
                                    selectedFilter ? (
                                        <TouchableOpacity
                                            onPress={() => setSelectedFilter("")}
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
                        </View>
                    )}

                    <TouchableOpacity
                        onPress={generatePdf}
                        className="bg-violet-600 p-3 rounded-lg items-center"
                        disabled={printing}
                        style={printing ? { opacity: 0.7 } : undefined}
                    >
                        {printing ? (
                            <View className="flex-row items-center">
                                <ActivityIndicator size="small" color="#fff" />
                                <Text className="text-white font-bold ml-2">Printing...</Text>
                            </View>
                        ) : (
                            <Text className="text-white font-bold">Print Report</Text>
                        )}
                    </TouchableOpacity>

                    <View className="flex-row justify-end items-center px-2">
                        <View className="flex-row items-center">
                            <Text className="text-sm text-gray-700 font-medium mr-2">All Game</Text>
                            <Switch
                                value={allGame}
                                onValueChange={setAllGame}
                                trackColor={{ false: "#e5e7eb", true: "#a78bfa" }}
                                thumbColor={allGame ? "#7c3aed" : "#f4f3f4"}
                                ios_backgroundColor="#e5e7eb"
                                style={{ transform: [{ scaleX: 0.9 }, { scaleY: 0.9 }] }}
                            />
                        </View>
                    </View>
                </View>}

                {/* --- Main Content Area --- */}
                {!selectedDraw?.id ? (
                    <View className="flex-1 justify-center items-center">
                        <Text className="text-base text-gray-500">
                            No draw selected. Please choose one.
                        </Text>
                    </View>
                ) : isLoading ? (
                    <View className="flex-1 justify-center items-center">
                        <ActivityIndicator size="large" color="#7c3aed" />
                        <Text className="mt-3 text-gray-600">Loading sales data...</Text>
                    </View>
                ) : error ? (
                    // Only show error if not loading
                    !isLoading && (
                        <View className="flex-1 bg-red-50 border border-red-200 px-4 py-3 rounded-lg justify-center items-center">
                            <Text className="text-red-700 font-medium">
                                Error loading report.
                            </Text>
                        </View>
                    )
                ) : (
                    <>
                        <View className="flex-1 rounded-2xl bg-white shadow-sm border border-gray-200 overflow-hidden mt-4">
                            <FlatList
                                data={allData}
                                keyExtractor={getBillKey}
                                renderItem={renderItem}
                                getItemLayout={getItemLayout}
                                ListHeaderComponent={listHeader}
                                ListEmptyComponent={
                                    <View className="flex-1 justify-center items-center py-16">
                                        <Text className="text-gray-500 text-base">No sales data for current filters.</Text>
                                    </View>
                                }
                                onEndReached={handleLoadMore}
                                onEndReachedThreshold={0.3}
                                initialNumToRender={20}
                                maxToRenderPerBatch={20}
                                windowSize={11}
                                removeClippedSubviews={true}
                                ListFooterComponent={
                                    isFetchingMore ? (
                                        <View className="py-4 items-center">
                                            <ActivityIndicator size="small" color="#7c3aed" />
                                            <Text className="text-xs text-gray-500 mt-1">
                                                Loading page {page + 1} of {totalPages}...
                                            </Text>
                                        </View>
                                    ) : hasMore ? (
                                        <View className="py-3 items-center">
                                            <Text className="text-xs text-gray-400">
                                                {allData.length} of {totalCount} bookings loaded
                                            </Text>
                                        </View>
                                    ) : allData.length > 0 ? (
                                        <View className="py-3 items-center">
                                            <Text className="text-xs text-gray-400">
                                                All {totalCount} bookings loaded
                                            </Text>
                                        </View>
                                    ) : null
                                }
                                refreshing={isFetching}
                                onRefresh={() => {
                                    setPage(1);
                                    setAllData([]);
                                    refetch();
                                }}
                            />
                        </View>
                    </>
                )}

                {shouldShowTotalFooter && (
                    <View className="border-t border-gray-200 py-3 bg-gray-100 px-4 mt-4 rounded-lg">
                        <View className="flex-row">
                            <Text className="flex-1 font-bold text-sm text-gray-800">TOTAL</Text>
                            <Text className="flex-1 text-sm"> </Text>
                            <Text className="flex-1 text-sm"> </Text>
                            <Text className="flex-1 text-sm text-center font-semibold text-gray-700">
                                {totalBillCount || 0}
                            </Text>
                            <Text className="flex-1 text-sm text-right font-semibold text-violet-700">
                                ₹{amountHandler(Number((user?.user_type === "ADMIN" || user?.user_type === "DEALER") ? totalDealerAmount?.toFixed(0) : totalAgentAmount?.toFixed(0) || 0))}
                            </Text>
                            <Text className="flex-1 text-sm text-right font-semibold text-emerald-700">
                                ₹{amountHandler(Number(totalCustomerAmount?.toFixed(0) || 0))}
                            </Text>
                        </View>
                    </View>
                )}

                {showFromPicker && (
                    <DateTimePicker
                        mode="date"
                        value={fromDate || getToday()}
                        onChange={(event, date) => {
                            if (date) {
                                // Always use local time, ignore timezone offset
                                const selectedDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
                                setFromDate(selectedDate);
                            }
                            setShowFromPicker(false);
                        }}
                    />
                )}
                {showToPicker && (
                    <DateTimePicker
                        mode="date"
                        value={toDate || getTomorrow()}
                        onChange={(event, date) => {
                            if (date) {
                                // Always use local time, ignore timezone offset
                                const selectedDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
                                setToDate(selectedDate);
                            }
                            setShowToPicker(false);
                        }}
                    />
                )}
            </View>
        </SafeAreaView>
    );
};

export default SalesReportScreen;