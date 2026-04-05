import { useAuthStore } from "@/store/auth";
import useDrawStore from "@/store/draw";
import { amountHandler } from "@/utils/amount";
import api from "@/utils/axios";
import { Entypo, Ionicons } from "@expo/vector-icons";
import { FlashList } from "@shopify/flash-list";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Modal,
    Pressable,
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

function getSubTypeOptions(number: string, drawType?: string) {
    if (!number) return [];
    if (drawType && drawType !== "default") return [];
    const num = number.replace(/\D/g, "");
    if (num.length === 3) return ["SUPER", "BOX"];
    if (num.length === 2) return ["AB", "BC", "AC"];
    if (num.length === 1) return ["A", "B", "C"];
    return [];
}

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
    actionsCol: { width: 48, flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 6 },
});

const headerStyles = StyleSheet.create({
    row: { flexDirection: "row", backgroundColor: "rgba(243,244,246,0.8)", borderBottomWidth: 1, borderBottomColor: "#e5e7eb", paddingHorizontal: 10, paddingVertical: 10 },
    col: { flex: 1, alignItems: "center" },
    countCol: { flex: 0.6, alignItems: "center" },
    amtCol: { flex: 1, alignItems: "flex-end" },
    text: { fontSize: 10, fontWeight: "600", color: "#4b5563", textTransform: "uppercase" },
    actionsCol: { width: 48 },
});

const footerStyle = { paddingVertical: 12, alignItems: "center" as const };
const emptyComponent = (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center", paddingVertical: 64 }}>
        <Text style={{ color: "#6b7280", fontSize: 14 }}>No booking details found.</Text>
    </View>
);

const DetailRow = React.memo(({ item, index, isEditable, isSuperuser, onMenuOpen, onDelete }: {
    item: DisplayRow; index: number; isEditable: boolean; isSuperuser: boolean;
    onMenuOpen: (item: DisplayRow) => void; onDelete: (item: DisplayRow) => void;
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
        {isEditable ? (
            <View style={rowStyles.actionsCol}>
                <TouchableOpacity onPress={() => onMenuOpen(item)} hitSlop={10}>
                    <Entypo name="dots-three-vertical" size={16} color="#6b7280" />
                </TouchableOpacity>
            </View>
        ) : isSuperuser ? (
            <View style={rowStyles.actionsCol}>
                <TouchableOpacity onPress={() => onDelete(item)} hitSlop={10}>
                    <Ionicons name="trash-outline" size={15} color="#ef4444" />
                </TouchableOpacity>
            </View>
        ) : null}
    </View>
));

const BookingDetailsScreen = () => {
    const { user } = useAuthStore();
    const { selectedDraw } = useDrawStore();
    const drawType = selectedDraw?.type || "default";
    const queryClient = useQueryClient();
    const params = useLocalSearchParams();
    const billNumber = params.bill_number as string | undefined;
    const initialSearch = (params.search as string) || "";
    const isEditable = params.editable === "true" && (user?.user_type !== "ADMIN" || !!user?.superuser);
    const isSuperuser = !!user?.superuser;
    const showActionsCol = isEditable || isSuperuser;

    const [search, setSearch] = useState(initialSearch);
    const [debouncedSearch, setDebouncedSearch] = useState(initialSearch);

    // Action menu state (3-dot menu)
    const [actionMenuItem, setActionMenuItem] = useState<DisplayRow | null>(null);

    useEffect(() => {
        const handle = setTimeout(() => setDebouncedSearch(search.trim()), 300);
        return () => clearTimeout(handle);
    }, [search]);

    // Edit modal state
    const [editModalVisible, setEditModalVisible] = useState(false);
    const [editDetail, setEditDetail] = useState<DisplayRow | null>(null);
    const [editNumber, setEditNumber] = useState("");
    const [editCount, setEditCount] = useState("");
    const [editSubType, setEditSubType] = useState("");
    const [editLoading, setEditLoading] = useState(false);
    const [editErrors, setEditErrors] = useState<{ number?: string; count?: string; subType?: string; non_field?: string }>({});
    const editNumberLengthRef = useRef<number>(0);
    const editSubTypeOptionsRef = useRef<string[]>([]);

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

    const openEditModal = useCallback((item: DisplayRow) => {
        setEditDetail(item);
        const numberStr = item.number?.toString() || "";
        setEditNumber(numberStr);
        setEditCount(item.count?.toString() || "");
        setEditSubType(item.sub_type || "");
        setEditErrors({});
        editNumberLengthRef.current = numberStr.length;
        editSubTypeOptionsRef.current = getSubTypeOptions(numberStr, drawType);
        setEditModalVisible(true);
    }, []);

    const validateEditForm = () => {
        const errors: { number?: string; count?: string; subType?: string } = {};
        const number = editNumber.trim();
        const count = editCount.trim();
        const subType = editSubType.trim();

        if (!number) {
            errors.number = "Number is required";
        } else if (!/^\d+$/.test(number)) {
            errors.number = "Number must be digits only";
        } else if (number.length !== editNumberLengthRef.current) {
            errors.number = `Number must be ${editNumberLengthRef.current} digit${editNumberLengthRef.current > 1 ? "s" : ""}`;
        }

        if (!count) {
            errors.count = "Count is required";
        } else if (!/^\d+$/.test(count) || parseInt(count, 10) <= 0) {
            errors.count = "Count must be a positive integer";
        } else if (number.length === 1 && parseInt(count, 10) < 5) {
            errors.count = "For single digit number, count must be at least 5";
        }

        const options = editSubTypeOptionsRef.current;
        if (options.length > 0 && !options.includes(subType)) {
            errors.subType = "Select a valid sub type";
        }

        setEditErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleEditSubmit = async () => {
        if (!editDetail?.id) return;
        if (!validateEditForm()) return;
        setEditLoading(true);
        try {
            await api.patch(`/draw-booking/booking-detail-manage/${editDetail.id}/`, {
                number: editNumber,
                count: Number(editCount),
                sub_type: editSubType,
            });
            setEditModalVisible(false);
            setEditDetail(null);
            setEditLoading(false);
            queryClient.invalidateQueries({ queryKey: ["booking-report-detail"] });
            queryClient.invalidateQueries({ queryKey: ["/draw-booking/booking-report/"] });
            refetch();
        } catch (err: any) {
            setEditLoading(false);
            let newErrors: { number?: string; count?: string; subType?: string; non_field?: string } = {};
            const data = err?.message && typeof err.message === "object" ? err.message : err?.response?.data;

            if (data && typeof data === "object") {
                if (data.non_field_errors && Array.isArray(data.non_field_errors)) {
                    newErrors.non_field = data.non_field_errors.join(" ");
                }
                if (data.count && Array.isArray(data.count)) {
                    newErrors.count = data.count.join(" ");
                }
                if (data.number && Array.isArray(data.number)) {
                    newErrors.number = data.number.join(" ");
                }
                if (data.sub_type && Array.isArray(data.sub_type)) {
                    newErrors.subType = data.sub_type.join(" ");
                }
            }

            setEditErrors(prev => ({ ...prev, ...newErrors }));

            if (newErrors.non_field || (!newErrors.count && !newErrors.number && !newErrors.subType)) {
                Alert.alert("Edit Failed", newErrors.non_field || "Could not update booking detail.");
            }
        }
    };

    const subTypeOptions = editSubTypeOptionsRef.current;

    const handleMenuOpen = useCallback((item: DisplayRow) => {
        setActionMenuItem(item);
    }, []);

    const renderItem = useCallback(({ item, index }: { item: DisplayRow; index: number }) => (
        <DetailRow item={item} index={index} isEditable={isEditable} isSuperuser={isSuperuser} onMenuOpen={handleMenuOpen} onDelete={handleDelete} />
    ), [isEditable, isSuperuser, handleDelete, handleMenuOpen]);

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
                                {showActionsCol && <View style={headerStyles.actionsCol} />}
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

            {/* Action Menu Modal (3-dot) */}
            <Modal
                visible={!!actionMenuItem}
                transparent
                animationType="fade"
                onRequestClose={() => setActionMenuItem(null)}
            >
                <Pressable
                    style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.35)", justifyContent: "center", alignItems: "center" }}
                    onPress={() => setActionMenuItem(null)}
                >
                    <View style={{
                        backgroundColor: "#fff",
                        borderRadius: 14,
                        paddingVertical: 8,
                        width: 220,
                        shadowColor: "#000",
                        shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: 0.15,
                        shadowRadius: 12,
                        elevation: 8,
                    }}>
                        <Text style={{ fontSize: 12, color: "#9ca3af", fontWeight: "600", paddingHorizontal: 16, paddingVertical: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>
                            {actionMenuItem?.sub_type} {actionMenuItem?.number}
                        </Text>

                        <TouchableOpacity
                            onPress={() => {
                                const item = actionMenuItem;
                                setActionMenuItem(null);
                                if (item) openEditModal(item);
                            }}
                            style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12 }}
                            activeOpacity={0.6}
                        >
                            <Ionicons name="pencil-outline" size={18} color="#7c3aed" />
                            <Text style={{ marginLeft: 12, fontSize: 15, fontWeight: "600", color: "#374151" }}>Edit</Text>
                        </TouchableOpacity>

                        <View style={{ height: 1, backgroundColor: "#f3f4f6", marginHorizontal: 12 }} />

                        <TouchableOpacity
                            onPress={() => {
                                const item = actionMenuItem;
                                setActionMenuItem(null);
                                if (item) handleDelete(item);
                            }}
                            style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12 }}
                            activeOpacity={0.6}
                        >
                            <Ionicons name="trash-outline" size={18} color="#ef4444" />
                            <Text style={{ marginLeft: 12, fontSize: 15, fontWeight: "600", color: "#ef4444" }}>Delete</Text>
                        </TouchableOpacity>
                    </View>
                </Pressable>
            </Modal>

            {/* Edit Modal */}
            <Modal
                visible={editModalVisible}
                transparent
                animationType="fade"
                onRequestClose={() => { setEditModalVisible(false); setEditDetail(null); }}
            >
                <Pressable
                    style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "center", alignItems: "center" }}
                    onPress={() => { setEditModalVisible(false); setEditDetail(null); }}
                >
                    <Pressable
                        style={{
                            backgroundColor: "#fff",
                            borderRadius: 16,
                            padding: 24,
                            width: "88%",
                            maxWidth: 400,
                        }}
                        onPress={() => {}}
                    >
                        <Text style={{ fontSize: 18, fontWeight: "700", color: "#1f2937", marginBottom: 18 }}>
                            Edit Booking Detail
                        </Text>

                        {editErrors.non_field && (
                            <View style={{ backgroundColor: "#fef2f2", borderRadius: 8, padding: 10, marginBottom: 12 }}>
                                <Text style={{ color: "#dc2626", fontSize: 13 }}>{editErrors.non_field}</Text>
                            </View>
                        )}

                        {/* Number */}
                        <Text style={{ fontSize: 13, fontWeight: "600", color: "#374151", marginBottom: 6 }}>Number</Text>
                        <TextInput
                            value={editNumber}
                            onChangeText={(t) => { setEditNumber(t.replace(/\D/g, "")); setEditErrors(e => ({ ...e, number: undefined })); }}
                            keyboardType="numeric"
                            maxLength={drawType === "kerala" ? 4 : (editNumberLengthRef.current || 3)}
                            style={{
                                borderWidth: 1,
                                borderColor: editErrors.number ? "#ef4444" : "#d1d5db",
                                borderRadius: 8,
                                paddingHorizontal: 12,
                                paddingVertical: 10,
                                fontSize: 16,
                                marginBottom: 4,
                                backgroundColor: editErrors.number ? "#fef2f2" : "#f9fafb",
                            }}
                        />
                        {editErrors.number && <Text style={{ color: "#ef4444", fontSize: 12, marginBottom: 8 }}>{editErrors.number}</Text>}

                        {/* Count */}
                        <Text style={{ fontSize: 13, fontWeight: "600", color: "#374151", marginBottom: 6, marginTop: 8 }}>Count</Text>
                        <TextInput
                            value={editCount}
                            onChangeText={(t) => { setEditCount(t.replace(/\D/g, "")); setEditErrors(e => ({ ...e, count: undefined })); }}
                            keyboardType="numeric"
                            style={{
                                borderWidth: 1,
                                borderColor: editErrors.count ? "#ef4444" : "#d1d5db",
                                borderRadius: 8,
                                paddingHorizontal: 12,
                                paddingVertical: 10,
                                fontSize: 16,
                                marginBottom: 4,
                                backgroundColor: editErrors.count ? "#fef2f2" : "#f9fafb",
                            }}
                        />
                        {editErrors.count && <Text style={{ color: "#ef4444", fontSize: 12, marginBottom: 8 }}>{editErrors.count}</Text>}

                        {/* Sub Type */}
                        {subTypeOptions.length > 0 && (
                            <>
                                <Text style={{ fontSize: 13, fontWeight: "600", color: "#374151", marginBottom: 6, marginTop: 8 }}>Sub Type</Text>
                                <View style={{ flexDirection: "row", gap: 8, marginBottom: 4 }}>
                                    {subTypeOptions.map((opt) => (
                                        <TouchableOpacity
                                            key={opt}
                                            onPress={() => { setEditSubType(opt); setEditErrors(e => ({ ...e, subType: undefined })); }}
                                            style={{
                                                paddingHorizontal: 16,
                                                paddingVertical: 8,
                                                borderRadius: 8,
                                                borderWidth: 1,
                                                borderColor: editSubType === opt ? "#7c3aed" : "#d1d5db",
                                                backgroundColor: editSubType === opt ? "#ede9fe" : "#f9fafb",
                                            }}
                                        >
                                            <Text style={{
                                                color: editSubType === opt ? "#7c3aed" : "#6b7280",
                                                fontWeight: editSubType === opt ? "700" : "500",
                                                fontSize: 13,
                                            }}>
                                                {opt}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                                {editErrors.subType && <Text style={{ color: "#ef4444", fontSize: 12, marginBottom: 8 }}>{editErrors.subType}</Text>}
                            </>
                        )}

                        {/* Actions */}
                        <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 12, marginTop: 20 }}>
                            <TouchableOpacity
                                onPress={() => { setEditModalVisible(false); setEditDetail(null); }}
                                style={{
                                    paddingHorizontal: 20,
                                    paddingVertical: 10,
                                    borderRadius: 8,
                                    borderWidth: 1,
                                    borderColor: "#d1d5db",
                                }}
                            >
                                <Text style={{ color: "#374151", fontWeight: "600" }}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={handleEditSubmit}
                                disabled={editLoading}
                                style={{
                                    paddingHorizontal: 20,
                                    paddingVertical: 10,
                                    borderRadius: 8,
                                    backgroundColor: editLoading ? "#a78bfa" : "#7c3aed",
                                }}
                            >
                                {editLoading ? (
                                    <ActivityIndicator size="small" color="#fff" />
                                ) : (
                                    <Text style={{ color: "#fff", fontWeight: "700" }}>Save</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </Pressable>
                </Pressable>
            </Modal>
        </SafeAreaView>
    );
};

export default BookingDetailsScreen;
