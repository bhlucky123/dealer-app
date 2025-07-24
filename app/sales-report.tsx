import { useAuthStore } from "@/store/auth";
import useDrawStore from "@/store/draw";
import api from "@/utils/axios";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { printToFileAsync } from 'expo-print';
import { shareAsync } from "expo-sharing";
import React, { useMemo, useState } from "react";
import {
    ActivityIndicator,
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

const getToday = () => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
};

const getTommorow = () => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
};

const formatDateDDMMYYYY = (date?: Date | null) => {
    if (!date) return "";
    const d = new Date(date);
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
};

const SalesReportScreen = () => {
    const { selectedDraw } = useDrawStore();
    const [search, setSearch] = useState("");
    const [fromDate, setFromDate] = useState<Date | null>(getToday());
    const [toDate, setToDate] = useState<Date | null>(getTommorow());
    const [showFromPicker, setShowFromPicker] = useState(false);
    const [showToPicker, setShowToPicker] = useState(false);
    const [fullView, setFullView] = useState(false);
    const [allGame, setAllGame] = useState(false);
    const [selectedFilter, setSelectedFilter] = useState("");

    const { user } = useAuthStore();
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

    const buildQuery = () => {

        const params: Record<string, string> = {};
        // if (search) params["search"] = search; // Remove search from backend
        if (fromDate) params["date_time__gte"] = fromDate.toISOString();
        if (toDate) params["date_time__lte"] = toDate.toISOString();
        // Always request full_view to get booking_details for the PDF
        params["full_view"] = "true";
        if (selectedDraw?.id && !allGame) params["draw_session__draw__id"] = String(selectedDraw.id);

        if (user?.user_type === "ADMIN" && selectedFilter) {
            params["booked_dealer__id"] = selectedFilter;
        }
        if (user?.user_type === "DEALER" && selectedFilter) {
            params["booked_agent__id"] = selectedFilter;
        }

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

    // Frontend search filter
    const filteredResult = useMemo(() => {
        if (!data?.result) return [];
        if (!search) return data.result;
        // Only filter by bill_number (as per placeholder)
        return data.result.filter(item =>
            item.bill_number?.toString().toLowerCase().includes(search.toLowerCase())
        );
    }, [data, search]);

    // Calculate totals for filtered data
    const filteredTotals = useMemo(() => {
        if (!filteredResult.length) {
            return {
                total_bill_count: 0,
                total_dealer_amount: 0,
                total_customer_amount: 0,
            };
        }
        return filteredResult.reduce(
            (acc, item) => {
                acc.total_bill_count += item.bill_count || 0;
                acc.total_dealer_amount += item.dealer_amount || 0;
                acc.total_customer_amount += item.customer_amount || 0;
                return acc;
            },
            {
                total_bill_count: 0,
                total_dealer_amount: 0,
                total_customer_amount: 0,
            }
        );
    }, [filteredResult]);

    const shouldShowTotalFooter = !!selectedDraw?.id && !isLoading && !error && data;

    const generatePdf = async () => {
        // Use filteredResult for PDF if search is applied, else use all data
        const pdfData = search ? filteredResult : (data?.result || []);
        if (!pdfData || pdfData.length === 0) {
            alert("No data available to generate PDF.");
            return;
        }

        // Generate table rows from the data
        const tableRows = pdfData.flatMap(bill =>
            bill.booking_details ? bill.booking_details.map(detail => `
                <tr>
                    <td>${bill.dealer?.username || 'N/A'}</td>
                    <td>${bill.bill_number || ''}</td>
                    <td>${detail.number}</td>
                    <td>${detail.count}</td>
                    <td>${detail.amount.toFixed(2)}</td>
                </tr>
            `).join('') : ''
        ).join('');

        // Use filtered total if search is applied, else backend total
        const totalAmount = search
            ? filteredTotals.total_customer_amount.toFixed(0)
            : (data?.total_customer_amount ? data.total_customer_amount.toFixed(2) : "0");
        const now = new Date();
        const formattedDate = formatDateDDMMYYYY(now);
        const formattedTime = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }).toUpperCase();

        const html = `
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
              color: #FFD700; /* Gold color for heading */
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
            <h1>${selectedDraw?.name}</h1>
            <p>${formattedDate} ${formattedTime}</p>
          </div>
          <table>
            <thead>
              <tr>
                <th>Agent</th>
                <th>Bill Number</th>
                <th>No</th>
                <th>Count</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              ${tableRows}
            </tbody>
          </table>
          <div class="footer">
            <p>Total Amount: ${totalAmount}</p>
          </div>
        </body>
      </html>
    `;

        try {
            const file = await printToFileAsync({
                html: html,
                base64: false,
                width: 595, // Standard A4 width in points
                height: 842, // Standard A4 height in points
            });

            await shareAsync(file.uri, { dialogTitle: 'Share Sales Report' });
        } catch (err) {
            alert("An error occurred while creating the PDF.");
        }
    };


    return (
        <SafeAreaView className="flex-1 bg-white">
            <View className="flex-1 p-4">
                {/* Filters */}
                <View className="gap-3">
                    <TextInput
                        placeholder="Search by Bill No."
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
                                onChange={item => setSelectedFilter(item.value)}
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
                                onChange={item => setSelectedFilter(item.value)}
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

                    <TouchableOpacity onPress={generatePdf} className="bg-violet-600 p-3 rounded-lg items-center">
                        <Text className="text-white font-bold">Print Report</Text>
                    </TouchableOpacity>

                    <View className="flex-row justify-between items-center   px-2">
                        <View className="flex-row items-center rounded-lg ">
                            <Text className="text-sm text-gray-700 font-medium mr-2">Full View</Text>
                            <Switch
                                value={fullView}
                                onValueChange={setFullView}
                                trackColor={{ false: "#e5e7eb", true: "#a78bfa" }}
                                thumbColor={fullView ? "#7c3aed" : "#f4f3f4"}
                                ios_backgroundColor="#e5e7eb"
                                style={{ transform: [{ scaleX: 0.9 }, { scaleY: 0.9 }] }}
                            />
                        </View>
                        <View className="flex-row items-center ">
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
                        <View className="flex-1 rounded-2xl bg-white shadow-sm border border-gray-200 overflow-hidden mt-4">
                            <FlatList
                                data={filteredResult || []}
                                keyExtractor={(item) => item.bill_number.toString()}
                                ListHeaderComponent={() => (
                                    <View className="flex-row bg-gray-100/80 border-b border-gray-200 px-4 py-3">
                                        <Text className="flex-[1.1] text-xs font-semibold text-gray-600 uppercase">Date</Text>
                                        <Text className="flex-[1.2] text-xs font-semibold text-center text-gray-600 uppercase">Dealer</Text>
                                        <Text className="flex-1 text-xs font-semibold text-center text-gray-600 uppercase">Bill No.</Text>
                                        <Text className="flex-1 text-xs font-semibold text-center text-gray-600 uppercase">Cnt</Text>
                                        <Text className="flex-1 text-xs font-semibold text-right text-gray-600 uppercase">D. Amt</Text>
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
                                            <Text className="flex-[1.2] text-sm text-center text-gray-700">{item.dealer.username}</Text>
                                            <Text className="flex-1 text-sm text-center text-gray-700">{item.bill_number}</Text>
                                            <Text className="flex-1 text-sm text-center text-gray-700">{item.bill_count}</Text>
                                            <Text className="flex-1 text-sm text-right text-violet-700 font-semibold">₹{item.dealer_amount.toFixed(0)}</Text>
                                            <Text className="flex-1 text-sm text-right text-emerald-700 font-semibold">₹{item.customer_amount.toFixed(0)}</Text>
                                        </View>

                                        {fullView && Array.isArray(item.booking_details) && item.booking_details.length > 0 && (
                                            <FlatList
                                                data={item?.booking_details || []}
                                                keyExtractor={(d) => d.id?.toString?.() ?? Math.random().toString()}
                                                renderItem={({ item: d }) => (
                                                    <View className="flex-row px-4 py-2 bg-amber-50/20 border-b border-amber-100 last:border-b-0">
                                                        <Text className="flex-[1.1] text-[10px] text-gray-600">{d.sub_type}</Text>
                                                        <Text className="flex-[1.2] text-[10px] text-center text-gray-600">{d.number}</Text>
                                                        <Text className="flex-1 text-[10px] text-center text-gray-600">{d.count}</Text>
                                                        <Text className="flex-1 text-[10px] text-center text-gray-600">₹{d.amount}</Text>
                                                        <Text className="flex-1 text-[10px] text-right text-violet-600">₹{d.dealer_amount.toFixed(0)}</Text>
                                                        <Text className="flex-1 text-[10px] text-right text-emerald-600">₹{d.agent_amount.toFixed(0)}</Text>
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
                                        <Text className="text-gray-500 text-base">No sales data for current filters.</Text>
                                    </View>
                                }
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
                                {search ? filteredTotals.total_bill_count : (data?.total_bill_count || 0)}
                            </Text>
                            <Text className="flex-1 text-sm text-right font-semibold text-violet-700">
                                ₹{search
                                    ? filteredTotals.total_dealer_amount.toFixed(2)
                                    : (data?.total_dealer_amount?.toFixed(0) || 0)}
                            </Text>
                            <Text className="flex-1 text-sm text-right font-semibold text-emerald-700">
                                ₹{search
                                    ? filteredTotals.total_customer_amount.toFixed(2)
                                    : (data?.total_customer_amount?.toFixed(0) || 0)}
                            </Text>
                        </View>
                    </View>
                )}

                {showFromPicker && (
                    <DateTimePicker
                        mode="date"
                        value={fromDate || getToday()}
                        onChange={(event, date) => {
                            if (date) setFromDate(new Date(date.getFullYear(), date.getMonth(), date.getDate()));
                            setShowFromPicker(false);
                        }}
                    />
                )}
                {showToPicker && (
                    <DateTimePicker
                        mode="date"
                        value={toDate || getToday()}
                        onChange={(event, date) => {
                            if (date) setToDate(new Date(date.getFullYear(), date.getMonth(), date.getDate()));
                            setShowToPicker(false);
                        }}
                    />
                )}
            </View>
        </SafeAreaView>
    );
};

export default SalesReportScreen;