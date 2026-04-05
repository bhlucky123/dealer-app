import { useAuthStore } from "@/store/auth";
import useDrawStore from "@/store/draw";
import { amountHandler } from "@/utils/amount";
import api from "@/utils/axios";
import { formatDateDDMMYYYY } from "@/utils/date";
import { Ionicons } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import React, { useCallback, useMemo } from "react";
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Pressable,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// Helper for today/tomorrow
const getToday = () => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
};
const getTomorrow = () => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
};

const LastSaleReportScreen = () => {
    const { selectedDraw } = useDrawStore();
    const { user, hasFeature } = useAuthStore();
    const router = useRouter();
    const queryClient = useQueryClient();
    const canDeleteBooking = hasFeature("delete_booking");

    // Delete booking state
    const [deleteBookingLoading, setDeleteBookingLoading] = React.useState(false);

    const buildQuery = () => {
        const params: Record<string, string> = {};
        const formatDateParam = (date: Date) => {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, "0");
            const day = String(date.getDate()).padStart(2, "0");
            return `${year}-${month}-${day}`;
        };
        params["date_time__gte"] = formatDateParam(getToday());
        params["date_time__lte"] = formatDateParam(getTomorrow());
        if (selectedDraw?.id) params["draw_session__draw__id"] = String(selectedDraw.id);

        return Object.keys(params)
            .map(key => encodeURIComponent(key) + "=" + encodeURIComponent(params[key]))
            .join("&");
    };

    const { data, isLoading, isFetching, error, refetch } = useQuery({
        queryKey: ["/draw-booking/booking-report/", buildQuery()],
        queryFn: async () => {
            const res = await api.get(`/draw-booking/booking-report/?${buildQuery()}`);
            return res.data;
        },
        enabled: !!selectedDraw?.id,
    });

    // Handle delete booking (entire booking)
    const handleDeleteBooking = useCallback((booking: any) => {
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
                        setDeleteBookingLoading(true);
                        try {
                            await api.delete(`/draw-booking/delete/${booking.bill_number}/`);
                            queryClient.invalidateQueries({ queryKey: ["/draw-booking/booking-report/"] });
                            queryClient.invalidateQueries({ queryKey: ["booking-report-detail"] });
                            refetch();
                        } catch (err: any) {
                            Alert.alert("Delete Failed", "Could not delete booking.");
                        } finally {
                            setDeleteBookingLoading(false);
                        }
                    }
                }
            ]
        );
    }, [queryClient, refetch]);

    const shouldShowTotalFooter = !!selectedDraw?.id && !isLoading && !error && data;

    const flatListData = useMemo(() => data?.results || [], [data]);

    const renderItem = useCallback(
        ({ item, index }: { item: any; index: number }) => (
            <TouchableOpacity
                className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}
                activeOpacity={0.7}
                onPress={() => router.push({ pathname: "/booking-details", params: { bill_number: String(item.bill_number), editable: "true" } })}
            >
                <View className="flex-row ps-3 pe-2 py-3 items-center border-b border-gray-100">
                    <View className="flex-[1.1] flex-col justify-center">
                        <Text className="text-[10px] text-gray-800 font-medium">{formatDateDDMMYYYY(new Date(item.date_time))}</Text>
                        <Text className="text-[9px] text-gray-500 mt-0.5">
                            {new Date(item.date_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false })}
                        </Text>
                    </View>
                    {user?.user_type !== 'AGENT' && (
                        <View className="flex-[1.2]">
                            <Text
                                className="flex-[1.2] text-sm text-center text-gray-700"
                                numberOfLines={1}
                                ellipsizeMode="tail"
                                style={{ minWidth: 0 }}
                            >
                                {item?.booked_by_name}
                            </Text>
                            {item?.booked_by_type && (
                                <Text
                                    className="text-xs text-center text-green-600"
                                    numberOfLines={1}
                                    ellipsizeMode="tail"
                                    style={{ minWidth: 0 }}
                                >
                                    {item.booked_by_type}
                                </Text>
                            )}
                        </View>
                    )}
                    <Text className="flex-1 text-sm text-center text-gray-700">{item.bill_number}</Text>
                    <Text className="flex-1 text-sm text-center text-gray-700">{item.total_booking_count}</Text>
                    <Text className="flex-1 text-sm text-right text-violet-700 font-semibold">
                        ₹{amountHandler(Number(user?.user_type === 'AGENT' ? item.calculated_agent_amount : item.calculated_dealer_amount))}
                    </Text>
                    <Text className="flex-1 text-sm text-right text-emerald-700 font-semibold">
                        ₹{amountHandler(Number(item.total_booking_amount))}
                    </Text>
                    {canDeleteBooking && (user?.user_type !== "ADMIN" || user?.superuser) && (
                        <View className="w-4 items-end ml-1">
                            <Pressable
                                onPress={(e) => {
                                    e.stopPropagation();
                                    handleDeleteBooking(item);
                                }}
                                hitSlop={10}
                            >
                                <Ionicons name="trash-outline" size={17} color="#ef4444" />
                            </Pressable>
                        </View>
                    )}
                </View>
            </TouchableOpacity>
        ),
        [user, handleDeleteBooking, router]
    );

    const keyExtractor = useCallback(
        (item: any, index: number) => item?.bill_number?.toString() || index?.toString(),
        []
    );

    return (
        <SafeAreaView className="flex-1 bg-white">
            <View className="flex-1 p-4">

                {/* --- Loading Overlay --- */}
                {!!selectedDraw?.id && (isLoading || isFetching) && (
                    <View
                        style={{
                            position: "absolute",
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            zIndex: 100,
                            backgroundColor: "rgba(255,255,255,0.7)",
                            justifyContent: "center",
                            alignItems: "center",
                        }}
                        pointerEvents="auto"
                    >
                        <ActivityIndicator size="large" color="#7c3aed" />
                        <Text className="mt-3 text-gray-600">Loading sales data...</Text>
                    </View>
                )}

                {/* --- Main Content Area --- */}
                {!selectedDraw?.id ? (
                    <View className="flex-1 justify-center items-center">
                        <Text className="text-base text-gray-500">
                            No draw selected. Please choose one.
                        </Text>
                    </View>
                ) : error ? (
                    <View className="flex-1 bg-red-50 border border-red-200 px-4 py-3 rounded-lg justify-center items-center">
                        <Text className="text-red-700 font-medium">
                            Error loading report.
                        </Text>
                    </View>
                ) : (
                    <>
                        <View className="flex-1 rounded-2xl bg-white shadow-sm border border-gray-200 overflow-hidden">
                            <FlatList
                                data={flatListData}
                                keyExtractor={keyExtractor}
                                ListHeaderComponent={() => (
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
                                )}
                                renderItem={renderItem}
                                ListEmptyComponent={
                                    <View className="flex-1 justify-center items-center py-16">
                                        <Text className="text-gray-500 text-base">
                                            No sales data found.
                                        </Text>
                                    </View>
                                }
                                initialNumToRender={10}
                                maxToRenderPerBatch={10}
                                windowSize={5}
                                removeClippedSubviews={true}
                                refreshing={isFetching}
                                onRefresh={() => refetch()}
                            />
                        </View>
                    </>
                )}

                {/* --- Total Footer --- */}
                {shouldShowTotalFooter && (
                    <View className="border-t border-gray-200 py-3 bg-gray-100 px-4 mt-4 rounded-lg">
                        <View className="flex-row">
                            <Text className="flex-1 font-bold text-sm text-gray-800">TOTAL</Text>
                            <Text className="flex-1 text-sm"> </Text>
                            <Text className="flex-1 text-sm"> </Text>
                            <Text className="flex-1 text-sm text-center font-semibold text-gray-700">
                                {data?.total_bill_count || 0}
                            </Text>
                            <Text className="flex-1 text-sm text-right font-semibold text-violet-700">
                                ₹{amountHandler(Number(data?.total_dealer_amount || 0))}
                            </Text>
                            <Text className="flex-1 text-sm text-right font-semibold text-emerald-700">
                                ₹{amountHandler(Number(data?.total_customer_amount || 0))}
                            </Text>
                        </View>
                    </View>
                )}
            </View>
        </SafeAreaView>
    );
};

export default LastSaleReportScreen;
