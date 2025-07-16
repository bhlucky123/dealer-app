import { useAuthStore } from "@/store/auth";
import useDrawStore from "@/store/draw";
import api from "@/utils/axios";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import React, { useState } from "react";
import {
    ActivityIndicator,
    FlatList,
    Text,
    View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Agent } from "./(tabs)/agent";



const dummyDetails = {
    "result": [
        {
            "bill_number": 1,
            "draw": "bh lucky",
            "date_time": "2025-07-12T09:09:21.287351Z",
            "bill_count": 8,
            "dealer_amount": 40.0,
            "agent_amount": 80,
            "customer_amount": 80,
            "booked_by": {
                "id": 2,
                "username": "d1",
                "user_type": "DEALER",
                "commission": 5.0,
                "single_digit_number_commission": 6.0,
                "cap_amount": 1000000.0
            },
            "dealer": {
                "id": 2,
                "username": "d1",
                "user_type": "DEALER",
                "commission": 5.0,
                "single_digit_number_commission": 6.0,
                "cap_amount": 1000000.0
            },
            "agent": null,
            "booking_details": [
                {
                    "id": 1,
                    "dealer_amount": -30.0,
                    "agent_amount": 10,
                    "number": "123",
                    "count": 8,
                    "amount": 10,
                    "type": "triple_digit",
                    "sub_type": "SUPER",
                    "is_main_box_number": false
                }
            ]
        },

        {
            "bill_number": 2,
            "draw": "mega star",
            "date_time": "2025-07-12T10:17:00Z",
            "bill_count": 5,
            "dealer_amount": 25.0,
            "agent_amount": 50,
            "customer_amount": 50,
            "booked_by": {
                "id": 3,
                "username": "dealer02",
                "user_type": "DEALER",
                "commission": 4.0,
                "single_digit_number_commission": 5.5,
                "cap_amount": 500000.0
            },
            "dealer": {
                "id": 3,
                "username": "dealer02",
                "user_type": "DEALER",
                "commission": 4.0,
                "single_digit_number_commission": 5.5,
                "cap_amount": 500000.0
            },
            "agent": null,
            "booking_details": [
                {
                    "id": 9,
                    "dealer_amount": -15.0,
                    "agent_amount": 5,
                    "number": "889",
                    "count": 5,
                    "amount": 5,
                    "type": "triple_digit",
                    "sub_type": "BOX",
                    "is_main_box_number": true
                }
            ]
        },

        {
            "bill_number": 3,
            "draw": "morning gold",
            "date_time": "2025-07-12T11:45:31Z",
            "bill_count": 10,
            "dealer_amount": 60.0,
            "agent_amount": 120,
            "customer_amount": 120,
            "booked_by": {
                "id": 4,
                "username": "agent01",
                "user_type": "AGENT",
                "commission": 6.0,
                "single_digit_number_commission": 7.0,
                "cap_amount": 750000.0
            },
            "dealer": {
                "id": 2,
                "username": "d1",
                "user_type": "DEALER",
                "commission": 5.0,
                "single_digit_number_commission": 6.0,
                "cap_amount": 1000000.0
            },
            "agent": {
                "id": 4,
                "username": "agent01",
                "user_type": "AGENT",
                "commission": 6.0,
                "single_digit_number_commission": 7.0,
                "cap_amount": 750000.0
            },
            "booking_details": [
                {
                    "id": 15,
                    "dealer_amount": -50.0,
                    "agent_amount": 20,
                    "number": "045",
                    "count": 10,
                    "amount": 12,
                    "type": "triple_digit",
                    "sub_type": "SUPER",
                    "is_main_box_number": false
                }
            ]
        },

        {
            "bill_number": 4,
            "draw": "night rider",
            "date_time": "2025-07-12T15:05:18Z",
            "bill_count": 3,
            "dealer_amount": 12.0,
            "agent_amount": 30,
            "customer_amount": 30,
            "booked_by": {
                "id": 5,
                "username": "dealer03",
                "user_type": "DEALER",
                "commission": 4.5,
                "single_digit_number_commission": 5.0,
                "cap_amount": 800000.0
            },
            "dealer": {
                "id": 5,
                "username": "dealer03",
                "user_type": "DEALER",
                "commission": 4.5,
                "single_digit_number_commission": 5.0,
                "cap_amount": 800000.0
            },
            "agent": null,
            "booking_details": [
                {
                    "id": 18,
                    "dealer_amount": -9.0,
                    "agent_amount": 3,
                    "number": "777",
                    "count": 3,
                    "amount": 3,
                    "type": "triple_digit",
                    "sub_type": "BOX",
                    "is_main_box_number": true
                }
            ]
        },

        {
            "bill_number": 5,
            "draw": "lucky evening",
            "date_time": "2025-07-12T17:32:44Z",
            "bill_count": 7,
            "dealer_amount": 35.0,
            "agent_amount": 70,
            "customer_amount": 70,
            "booked_by": {
                "id": 6,
                "username": "agent02",
                "user_type": "AGENT",
                "commission": 5.5,
                "single_digit_number_commission": 6.5,
                "cap_amount": 600000.0
            },
            "dealer": {
                "id": 3,
                "username": "dealer02",
                "user_type": "DEALER",
                "commission": 4.0,
                "single_digit_number_commission": 5.5,
                "cap_amount": 500000.0
            },
            "agent": {
                "id": 6,
                "username": "agent02",
                "user_type": "AGENT",
                "commission": 5.5,
                "single_digit_number_commission": 6.5,
                "cap_amount": 600000.0
            },
            "booking_details": [
                {
                    "id": 22,
                    "dealer_amount": -24.5,
                    "agent_amount": 7,
                    "number": "931",
                    "count": 7,
                    "amount": 7,
                    "type": "triple_digit",
                    "sub_type": "SUPER",
                    "is_main_box_number": false
                }
            ]
        },

        {
            "bill_number": 6,
            "draw": "midday jackpot",
            "date_time": "2025-07-12T12:58:13Z",
            "bill_count": 4,
            "dealer_amount": 20.0,
            "agent_amount": 40,
            "customer_amount": 40,
            "booked_by": {
                "id": 7,
                "username": "dealer04",
                "user_type": "DEALER",
                "commission": 4.0,
                "single_digit_number_commission": 5.0,
                "cap_amount": 550000.0
            },
            "dealer": {
                "id": 7,
                "username": "dealer04",
                "user_type": "DEALER",
                "commission": 4.0,
                "single_digit_number_commission": 5.0,
                "cap_amount": 550000.0
            },
            "agent": null,
            "booking_details": [
                {
                    "id": 27,
                    "dealer_amount": -16.0,
                    "agent_amount": 4,
                    "number": "864",
                    "count": 4,
                    "amount": 4,
                    "type": "triple_digit",
                    "sub_type": "BOX",
                    "is_main_box_number": true
                }
            ]
        }
    ],
    "total_bill_count": 8,
    "total_dealer_amount": 40.0,
    "total_agent_amount": 80,
    "total_customer_amount": 80
}


const LastSaleReportScreen = () => {
    const { selectedDraw } = useDrawStore();
    const [search, setSearch] = useState("");
    const [fromDate, setFromDate] = useState<Date | null>(new Date());
    const [toDate, setToDate] = useState<Date | null>(new Date());
    const [showFromPicker, setShowFromPicker] = useState(false);
    const [showToPicker, setShowToPicker] = useState(false); // Corrected this state variable name
    const [fullView, setFullView] = useState(false);
    const [selectedAgent, setSelectedAgent] = useState("")

    const { user } = useAuthStore()

    const buildQuery = () => {
        // Use an index signature to allow dynamic keys
        const params: Record<string, string> = {};

        if (search) params["search"] = search;
        if (fromDate) params["date_time__gte"] = fromDate.toISOString();
        if (toDate) params["date_time__lte"] = toDate.toISOString();
        if (fullView) params["full_view"] = "true";
        if (selectedAgent) params["booked_agent__id"] = selectedAgent;
        // if (user?.user_type === "AGENT") params["booked_agent__id"] = user.id?.toString();
        if (selectedDraw?.id) params["draw_session__draw__id"] = String(selectedDraw.id);

        console.log("params", params);

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

    // console.log("sales-report", data, "selectedDraw.id", selectedDraw?.id);


    // const data = dummyDetails


    const queryClient = useQueryClient();
    const cachedAgents = queryClient.getQueryData<Agent[]>(["agents"]);

    const {
        data: agents = [],
        isLoading: isAgentLoading,
        isError,
        error: AgentError,
        refetch,
        isFetching,
    } = useQuery<Agent[]>({
        queryKey: ["agents"],
        queryFn: () => api.get("/agent/agent/").then((res) => res.data),
        enabled: !cachedAgents, // Only fetch if not already cached
        initialData: cachedAgents, // Use cached data if available
    });

    // Determine if we should show the total footer
    // It should show if data is successfully loaded (not loading, no error) and a draw is selected
    const shouldShowTotalFooter = !!selectedDraw?.id && !isLoading && !error && data;

    return (
        <SafeAreaView className="flex-1 bg-white">
            <View className="flex-1 p-4">
                {/* Filters */}
                {/* <View className="gap-3">
                    <TextInput
                        placeholder="Search by Bill No."
                        value={search}
                        keyboardType="numeric"
                        onChangeText={setSearch}
                        className="border border-gray-300 rounded-lg px-4 py-3 text-base focus:border-violet-500"
                        placeholderTextColor="#9ca3af"
                    />

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
                                    {fromDate?.toLocaleDateString() || "Select Date"}
                                </Text>
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => setShowToPicker(true)} // Corrected state setter name
                            className="flex-1 border border-gray-300 rounded-lg px-4 py-3 active:bg-gray-50"
                        >
                            <Text className="text-gray-700">
                                To:{" "}
                                <Text
                                    className={toDate ? "text-gray-900 font-medium" : "text-gray-500"}
                                >
                                    {toDate?.toLocaleDateString() || "Select Date"}
                                </Text>
                            </Text>
                        </TouchableOpacity>
                    </View>

                    <RNPickerSelect
                        onValueChange={setSelectedAgent}
                        items={[
                            ...agents.map((agent) => ({
                                label: agent.username,
                                value: agent.id,
                                key: agent.id.toString(),
                            })),
                        ]}
                        value={selectedAgent}
                        style={{
                            viewContainer: {
                                borderColor: "#9ca3af",
                                borderWidth: 1,
                                borderRadius: 6,
                            },
                            placeholder: {
                                color: "#374151"
                            }
                        }}
                        placeholder={{ label: "Select Agent", value: null }}
                        Icon={() =>
                            selectedAgent !== null ? (
                                <TouchableOpacity
                                    onPress={() => setSelectedAgent("")}
                                    style={{ position: "absolute", right: 10, top: 12, zIndex: 10 }}
                                    className="bg-white w-10 h-10 flex items-center"
                                >
                                    <Text style={{ color: "#9ca3af", fontSize: 18 }}>✕</Text>
                                </TouchableOpacity>
                            ) : null
                        }
                    />

                    <View className="flex-row items-center justify-between px-1 pt-1">
                        <Text className="text-sm text-gray-700">Full View</Text>
                        <Switch
                            value={fullView}
                            onValueChange={setFullView}
                            trackColor={{ false: "#e5e7eb", true: "#a78bfa" }} // Gray for off, Violet-400 for on
                            thumbColor={fullView ? "#7c3aed" : "#f4f3f4"} // Violet-600 for on, White for off
                            ios_backgroundColor="#e5e7eb"
                        />
                    </View>
                </View> */}

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
                        {data?.result?.length ? (
                            <View className="flex-1 rounded-2xl bg-white shadow-sm border border-gray-200 overflow-hidden">
                                <FlatList
                                    data={data.result}
                                    keyExtractor={(item) => item.bill_number.toString()}
                                    ListHeaderComponent={() => (
                                        <View className="flex-row bg-gray-100/80 border-b border-gray-200 px-4 py-3">
                                            <Text className="flex-[1.1] text-xs font-semibold text-gray-600 uppercase">
                                                Date & Time
                                            </Text>
                                            <Text className="flex-[1.2] text-xs font-semibold text-center text-gray-600 uppercase">
                                                Dealer
                                            </Text>
                                            <Text className="flex-1 text-xs font-semibold text-center text-gray-600 uppercase">
                                                Bill No.
                                            </Text>
                                            <Text className="flex-1 text-xs font-semibold text-center text-gray-600 uppercase">
                                                Cnt
                                            </Text>
                                            <Text className="flex-1 text-xs font-semibold text-right text-gray-600 uppercase">
                                                D. Amt
                                            </Text>
                                            <Text className="flex-1 text-xs font-semibold text-right text-gray-600 uppercase">
                                                C. Amt
                                            </Text>
                                        </View>
                                    )}
                                    renderItem={({ item, index }) => (
                                        <View className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                                            {/* ------------ main bill row ------------ */}
                                            <View className="flex-row px-4 py-3 items-center border-b border-gray-100">
                                                <View className="flex-[1.1] flex-col justify-center">
                                                    <Text className="text-[10px] text-gray-800 font-medium">
                                                        {new Date(item.date_time).toLocaleDateString()}
                                                    </Text>
                                                    <Text className="text-[9px] text-gray-500 mt-0.5">
                                                        {new Date(item.date_time).toLocaleTimeString([], {
                                                            hour: "2-digit",
                                                            minute: "2-digit",
                                                            hour12: false,
                                                        })}
                                                    </Text>
                                                </View>
                                                <Text className="flex-[1.2] text-sm text-center text-gray-700">
                                                    {item.dealer.username}
                                                </Text>
                                                <Text className="flex-1 text-sm text-center text-gray-700">
                                                    {item.bill_number}
                                                </Text>
                                                <Text className="flex-1 text-sm text-center text-gray-700">
                                                    {item.bill_count}
                                                </Text>
                                                <Text className="flex-1 text-sm text-right text-violet-700 font-semibold">
                                                    {item.dealer_amount.toFixed(2)} {/* Format to 2 decimal places */}
                                                </Text>
                                                <Text className="flex-1 text-sm text-right text-emerald-700 font-semibold">
                                                    {item.customer_amount.toFixed(2)}{" "}
                                                    {/* Format to 2 decimal places */}
                                                </Text>
                                            </View>

                                            {/* ------------ optional detail rows (Full View) ------------ */}
                                            {fullView &&
                                                item.booking_details?.map((d) => (
                                                    <View
                                                        key={d.id}
                                                        className="flex-row px-4 py-2 bg-amber-50/20 border-b border-amber-100 last:border-b-0"
                                                    >
                                                        <Text className="flex-[1.1] text-[10px] text-gray-600">
                                                            {d.sub_type}
                                                        </Text>
                                                        <Text className="flex-[1.2] text-[10px] text-center text-gray-600">
                                                            {d.number}
                                                        </Text>
                                                        <Text className="flex-1 text-[10px] text-center text-gray-600">
                                                            {d.count}
                                                        </Text>
                                                        <Text className="flex-1 text-[10px] text-center text-gray-600">
                                                            {d.amount}
                                                        </Text>
                                                        <Text className="flex-1 text-[10px] text-right text-violet-600">
                                                            {d.dealer_amount.toFixed(2)}
                                                        </Text>
                                                        <Text className="flex-1 text-[10px] text-right text-emerald-600">
                                                            {d.agent_amount.toFixed(2)}
                                                        </Text>
                                                    </View>
                                                ))}
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
                        ) : (
                            <View className="flex-1 justify-center items-center">
                                <Text className="text-gray-500">No sales data available.</Text>
                            </View>
                        )}

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
                                {data?.total_bill_count || 0} {/* Ensure 0 if null/undefined */}
                            </Text>
                            <Text className="flex-1 text-sm text-right font-semibold text-violet-700">
                                {data?.total_dealer_amount || 0}
                            </Text>
                            <Text className="flex-1 text-sm text-right font-semibold text-emerald-700">
                                {data?.total_customer_amount || 0}
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