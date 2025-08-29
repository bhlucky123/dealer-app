import { useAuthStore } from "@/store/auth";
import useDrawStore from "@/store/draw";
import { amountHandler } from "@/utils/amount";
import api from "@/utils/axios";
import { formatDateDDMMYYYY } from "@/utils/date";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
    ActivityIndicator,
    FlatList,
    Text,
    View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const getToday = () => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
};

const getTommorow = () => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
};

const LastSaleReportScreen = () => {
    const { selectedDraw } = useDrawStore();
    const [fromDate, setFromDate] = useState<Date | null>(getToday());
    const [toDate, setToDate] = useState<Date | null>(getTommorow());
    const [showFromPicker, setShowFromPicker] = useState(false);
    const [showToPicker, setShowToPicker] = useState(false); // Corrected this state variable name
    const [fullView, setFullView] = useState(false);

    const { user } = useAuthStore()



    const buildQuery = () => {
        // Use an index signature to allow dynamic keys
        const params: Record<string, string> = {};

        // Format date as yyyy-mm-dd
        const formatDateYYYYMMDD = (date: Date) => {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, "0");
            const day = String(date.getDate()).padStart(2, "0");
            return `${year}-${month}-${day}`;
        };
        if (fromDate) params["date_time__gte"] = formatDateYYYYMMDD(fromDate);
        if (toDate) params["date_time__lte"] = formatDateYYYYMMDD(toDate);
        if (fullView) params["full_view"] = "true";
        // if (user?.user_type === "AGENT") params["booked_agent__id"] = user.id?.toString();
        if (selectedDraw?.id) params["draw_session__draw__id"] = String(selectedDraw.id);


        // Convert params object to query string
        return Object.keys(params)
            .map(key => encodeURIComponent(key) + "=" + encodeURIComponent(params[key]))
            .join("&");
    };

    const { data, isLoading, error } = useQuery({
        queryKey: ["/draw-booking/sales-report/", buildQuery()],
        queryFn: async () => {
            const res = await api.get(`/draw-booking/sales-report/?${buildQuery()}`);
            return res.data;
        },
        enabled: !!selectedDraw?.id,
    });

    console.log('data', data);



    // Determine if we should show the total footer
    // It should show if data is successfully loaded (not loading, no error) and a draw is selected
    const shouldShowTotalFooter = !!selectedDraw?.id && !isLoading && !error && data;

    return (
        <SafeAreaView className="flex-1 bg-white">
            <View className="flex-1 p-4">

                {/* --- Main Content Area --- */}
                {/* Conditional rendering for status messages or the report table */}
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
                    <View className="flex-1 bg-red-50 border border-red-200 px-4 py-3 rounded-lg justify-center items-center">
                        <Text className="text-red-700 font-medium">
                            Error loading report.
                        </Text>
                    </View>
                ) : (
                    <>
                        {/* {data?.result?.length ? ( */}
                        <View className="flex-1 rounded-2xl bg-white shadow-sm border border-gray-200 overflow-hidden">
                            <FlatList
                                data={data?.results?.data || []}
                                keyExtractor={(item, index) => item?.bill_number?.toString() || index?.toString()}
                                ListHeaderComponent={() => (
                                    <View className="flex-row bg-gray-100/80 border-b border-gray-200 px-4 py-3">
                                        <Text className="flex-[1.1] text-xs font-semibold text-gray-600 uppercase">Date</Text>
                                        {
                                            user?.user_type !== 'AGENT' && (
                                                <Text className="flex-[1.2] text-xs font-semibold text-center text-gray-600 uppercase">Booked</Text>)}
                                        <Text className="flex-1 text-xs font-semibold text-center text-gray-600 uppercase">Bill No.</Text>
                                        <Text className="flex-1 text-xs font-semibold text-center text-gray-600 uppercase">Cnt</Text>
                                        <Text className="flex-1 text-xs font-semibold text-right text-gray-600 uppercase">{user?.user_type === 'AGENT' ? 'D. Amt' : 'Amt'}</Text>
                                        <Text className="flex-1 text-xs font-semibold text-right text-gray-600 uppercase">C. Amt</Text>
                                    </View>
                                )}
                                renderItem={({ item, index }) => (
                                    <View className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                                        <View className="flex-row px-4 py-3 items-center border-b border-gray-100">
                                            <View className="flex-[1.1] flex-col justify-center">
                                                <Text className="text-[10px] text-gray-800 font-medium">{formatDateDDMMYYYY(new Date(item.date_time))}</Text>
                                                <Text className="text-[9px] text-gray-500 mt-0.5">
                                                    {new Date(item.date_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false, })}
                                                </Text>
                                            </View>
                                            {
                                                user?.user_type !== 'AGENT' && (
                                                    <View className="flex-[1.2]">
                                                        <Text
                                                            className="flex-[1.2] text-sm text-center text-gray-700"
                                                            numberOfLines={1}
                                                            ellipsizeMode="tail"
                                                            style={{ minWidth: 0 }}
                                                        >
                                                            {item?.booked_by?.username}
                                                        </Text>
                                                        {item?.booked_by?.user_type && (
                                                            <Text
                                                                className="text-xs text-center text-green-600"
                                                                numberOfLines={1}
                                                                ellipsizeMode="tail"
                                                                style={{ minWidth: 0 }}
                                                            >
                                                                {item.booked_by.user_type}
                                                            </Text>
                                                        )}
                                                    </View>
                                                )
                                            }
                                            <Text className="flex-1 text-sm text-center text-gray-700">{item.bill_number}</Text>
                                            <Text className="flex-1 text-sm text-center text-gray-700">{item.bill_count}</Text>
                                            <Text className="flex-1 text-sm text-right text-violet-700 font-semibold">₹{amountHandler(Number(user?.user_type === 'AGENT' ? item.agent_amount : item.dealer_amount))}</Text>
                                            <Text className="flex-1 text-sm text-right text-emerald-700 font-semibold">₹{amountHandler(Number(item.customer_amount))}</Text>
                                        </View>

                                        {fullView && Array.isArray(item.booking_details) && item.booking_details.length > 0 && (
                                            <FlatList
                                                data={item?.booking_details || []}
                                                keyExtractor={(d) => d.id?.toString?.() ?? Math.random().toString()}
                                                renderItem={({ item: d }) => (
                                                    <View className="flex-row px-4 py-2 bg-amber-50/20 border-b border-amber-100 last:border-b-0">
                                                        {
                                                            user?.user_type !== 'AGENT' &&
                                                            <Text className="flex-[1.2] text-[10px] text-center text-gray-600"></Text>
                                                        }
                                                        <Text className="flex-[1.1] text-[10px] text-gray-600">{d.sub_type} {d.number}</Text>
                                                        <Text className="flex-1 text-[10px] text-center text-gray-600">₹{amountHandler(Number(d.amount))}</Text>

                                                        <Text className="flex-1 text-[10px] text-center text-gray-600">{d.count}</Text>
                                                        <Text className="flex-1 text-[10px] text-right text-violet-600">₹{amountHandler(Number(user?.user_type === 'AGENT' ? d.agent_amount : d.dealer_amount))}</Text>
                                                        <Text className="flex-1 text-[10px] text-right text-emerald-600">₹{amountHandler(Number(d.customer_amount))}</Text>
                                                    </View>
                                                )}
                                                initialNumToRender={5}
                                                maxToRenderPerBatch={10}
                                                windowSize={5}
                                                removeClippedSubviews={true}
                                                scrollEnabled={false}
                                            />
                                        )}
                                    </View>
                                )}
                                ListEmptyComponent={
                                    <View className="flex-1 justify-center items-center py-16">
                                        <Text className="text-gray-500 text-base">
                                            No sales data for current filters.
                                        </Text>
                                    </View>
                                }
                            // Optional: Add a small footer if you want a visual break at the end of the list
                            // ListFooterComponent={() => <View className="h-4 bg-gray-50"></View>}
                            />
                        </View>
                        {/* ) : (
                            <View className="flex-1 justify-center items-center">
                                <Text className="text-gray-500">No sales data available.</Text>
                            </View>
                        )} */}

                    </>
                )}

                {/* --- Total Footer (always at the bottom if applicable) --- */}
                {shouldShowTotalFooter && (
                    <View className="border-t border-gray-200 py-3 bg-gray-100 px-4 mt-4 rounded-lg">
                        <View className="flex-row">
                            <Text className="flex-1 font-bold text-sm text-gray-800">TOTAL</Text>
                            <Text className="flex-1 text-sm"> </Text>
                            <Text className="flex-1 text-sm"> </Text>
                            <Text className="flex-1 text-sm text-center font-semibold text-gray-700">
                                {data?.results?.total_bill_count || 0} {/* Ensure 0 if null/undefined */}
                            </Text>
                            <Text className="flex-1 text-sm text-right font-semibold text-violet-700">
                                {amountHandler(Number(data?.results?.total_dealer_amount || 0))}
                            </Text>
                            <Text className="flex-1 text-sm text-right font-semibold text-emerald-700">
                                {amountHandler(Number(data?.results?.total_customer_amount || 0))}
                            </Text>
                        </View>
                    </View>
                )}

                {/* --- Date Pickers --- */}
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

export default LastSaleReportScreen;