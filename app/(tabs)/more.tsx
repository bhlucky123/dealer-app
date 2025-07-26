import { useAuthStore } from "@/store/auth";
import api from "@/utils/axios";
import { useMutation, useQuery } from "@tanstack/react-query";
import React, { useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    Switch,
    Text,
    TextInput,
    ToastAndroid,
    TouchableOpacity,
    View,
} from "react-native";

// --- Types ---
type BankDetails = {
    id: number;
    user: number;
    bank_details: string;
    user_type?: string;
    name?: string;
};

type BankDetailsResponse = {
    admin_bank_details?: BankDetails;
    dealer_bank_details?: BankDetails;
    agent_bank_details?: BankDetails;
};

type myBalanceResponse = {
    balance_amount?: number
}

interface PrizeConfig {
    single_digit_prize: number;
    double_digit_prize: number;
    box_direct: number;
    box_indirect: number;
    super_first_prize: number;
    super_second_prize: number;
    super_third_prize: number;
    super_fourth_prize: number;
    super_fifth_prize: number;
    super_complementary_prize: number;
}

const PRIZE_CONFIG_FIELDS: { key: keyof PrizeConfig; label: string }[] = [
    { key: "single_digit_prize", label: "Single Digit Prize" },
    { key: "double_digit_prize", label: "Double Digit Prize" },
    { key: "box_direct", label: "Box Direct" },
    { key: "box_indirect", label: "Box Indirect" },
    { key: "super_first_prize", label: "Super First Prize" },
    { key: "super_second_prize", label: "Super Second Prize" },
    { key: "super_third_prize", label: "Super Third Prize" },
    { key: "super_fourth_prize", label: "Super Fourth Prize" },
    { key: "super_fifth_prize", label: "Super Fifth Prize" },
    { key: "super_complementary_prize", label: "Super Complementary Prize" },
];

// --- Main Component ---
export default function MoreTab() {
    const { setApplicationStatus, application_status, user } = useAuthStore();

    // --- State ---
    const [editingBankDetails, setEditingBankDetails] = useState<null | "admin" | "dealer" | "agent">(null);
    const [bankDetailsInput, setBankDetailsInput] = useState("");
    const [bankDetailsError, setBankDetailsError] = useState<string | null>(null);

    const [localStatus, setLocalStatus] = useState<boolean | null>(null);
    const [statusLoading, setStatusLoading] = useState(false);
    const statusTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // UI state for which section is open: "bank", "prize", "toggle"
    const [activeSection, setActiveSection] = useState<"bank" | "prize" | "toggle">("bank");

    // Prize config edit state
    const [isEditingPrizeConfig, setIsEditingPrizeConfig] = useState(false);
    const [prizeConfigForm, setPrizeConfigForm] = useState<PrizeConfig | null>(null);
    const [prizeConfigError, setPrizeConfigError] = useState<string | null>(null);

    // --- Mutations ---
    const deactivateMutation = useMutation({
        mutationFn: () => api.post("/administrator/deactivate/"),
        onMutate: async () => {
            setStatusLoading(true);
            setLocalStatus(false);
        },
        onSuccess: () => {
            setApplicationStatus(false);
            setStatusLoading(false);
            setLocalStatus(null);
            ToastAndroid.show("Account deactivated", ToastAndroid.SHORT);
        },
        onError: () => {
            setStatusLoading(false);
            setLocalStatus(null);
            Alert.alert("Error", "Failed to deactivate");
        }
    });

    const activateMutation = useMutation({
        mutationFn: () => api.post("/administrator/activate/"),
        onMutate: async () => {
            setStatusLoading(true);
            setLocalStatus(true);
        },
        onSuccess: () => {
            setApplicationStatus(true);
            setStatusLoading(false);
            setLocalStatus(null);
            ToastAndroid.show("Account activated", ToastAndroid.SHORT);
        },
        onError: (err: any) => {
            if (
                err &&
                err.status === 400 &&
                err.message &&
                (
                    err.message === "Application is already active." ||
                    (typeof err.message === "object" && err.message.message === "Application is already active.")
                )
            ) {
                setApplicationStatus(true);
            }
            setStatusLoading(false);
            setLocalStatus(null);
            Alert.alert("Error", "Failed to activate");
        }
    });

    // --- Queries ---
    const { data: prizeConfig, isLoading: isPrizeConfigLoading, refetch: refetchPrizeConfig } = useQuery<PrizeConfig>({
        queryKey: ["/administrator/prize-configuration", user?.id],
        queryFn: async () => {
            const res = await api.get(`/administrator/prize-configuration/${user?.id}/`);
            return res.data as PrizeConfig;
        },
        enabled: user?.user_type === "ADMIN"
    });

    const { mutate: prizeConfigMutation, isPending: isPrizeConfigSaving } = useMutation({
        mutationFn: async (payload: PrizeConfig) => {
            return await api.patch(`/administrator/prize-configuration/${user?.id}/`, payload);
        },
        onSuccess: () => {
            setIsEditingPrizeConfig(false);
            setPrizeConfigError(null);
            refetchPrizeConfig();
            ToastAndroid.show("Prize configuration updated", ToastAndroid.SHORT);
        },
        onError: () => {
            setPrizeConfigError("Failed to update prize configuration");
        }
    });

    const {
        data: bankDetailsData,
        isLoading: isBankDetailsLoading,
        refetch: refetchBankDetails,
    } = useQuery<BankDetailsResponse>({
        queryKey: ["bank-details", user?.id, user?.user_type],
        enabled: !!user?.id,
        queryFn: async () => {
            try {
                const res = await api.get("/draw-payment/bank-details/");
                return res.data as BankDetailsResponse;
            } catch (err) {
                return {};
            }
        }
    });

    const {
        data: myBalance,
        isLoading: ismyBalanceLoading,
        refetch: refetchMyBalance,
        isFetching: isFetchingMyBalance,
    } = useQuery<myBalanceResponse>({
        queryKey: ["/draw-payment/get-my-pending-balance/"],
        enabled: (user?.user_type === "AGENT" || user?.user_type === "DEALER"),
        queryFn: async () => {
            try {
                const res = await api.get("/draw-payment/get-my-pending-balance/");
                return res.data as myBalanceResponse;
            } catch (err) {
                return { balance_amount: 0 };
            }
        },
        refetchOnMount: true
    });

    // --- Helpers ---
    function getBankDetailsForEdit(type: "admin" | "dealer" | "agent") {
        if (!bankDetailsData) return null;
        if (type === "admin") return bankDetailsData.admin_bank_details || null;
        if (type === "dealer") return bankDetailsData.dealer_bank_details || null;
        return null;
    }

    const bankDetailsMutation = useMutation({
        mutationFn: async ({
            type,
            bank_details,
        }: {
            type: "admin" | "dealer" | "agent";
            bank_details: string;
        }) => {
            if (!user?.id) throw new Error("No user id");
            const details = getBankDetailsForEdit(type);
            let url = "/draw-payment/bank-details/";
            let method: "patch" | "post" = "post";
            if (details?.id) {
                url += `${details.id}/`;
                method = "patch";
            }
            const payload: any = {
                bank_details,
                user: user.id,
            };
            if (type === "admin") payload.user_type = "ADMIN";
            if (type === "dealer") payload.user_type = "DEALER";
            if (type === "agent") payload.user_type = "AGENT";

            if (method === "patch") {
                return api.patch(url, payload);
            } else {
                return api.post(url, payload);
            }
        },
        onSuccess: () => {
            setEditingBankDetails(null);
            setBankDetailsInput("");
            setBankDetailsError(null);
            refetchBankDetails();
            ToastAndroid.show("Bank details updated", ToastAndroid.SHORT);
        },
        onError: () => {
            setBankDetailsError("Failed to update bank details");
        }
    });

    // --- UI Handlers ---
    const handleToggle = (value: boolean) => {
        if (statusLoading || activateMutation.isPending || deactivateMutation.isPending) return;
        if (application_status === value) return;
        setLocalStatus(value);
        setStatusLoading(true);
        if (statusTimeoutRef.current) clearTimeout(statusTimeoutRef.current);
        statusTimeoutRef.current = setTimeout(() => {
            setStatusLoading(false);
            setLocalStatus(null);
        }, 10000);

        if (value) {
            activateMutation.mutate(undefined, {
                onSuccess: () => {
                    setStatusLoading(false);
                    setLocalStatus(null);
                    if (statusTimeoutRef.current) clearTimeout(statusTimeoutRef.current);
                }
            });
        } else {
            deactivateMutation.mutate(undefined, {
                onSuccess: () => {
                    setStatusLoading(false);
                    setLocalStatus(null);
                    if (statusTimeoutRef.current) clearTimeout(statusTimeoutRef.current);
                }
            });
        }
    };

    // --- UI Renderers ---

    // --- New: Card component for better structure ---
    function Card({ title, children, style = {} }: { title?: string, children: React.ReactNode, style?: any }) {
        return (
            <View
                style={{
                    backgroundColor: "#fff",
                    borderRadius: 18,
                    padding: 18,
                    marginBottom: 18,
                    shadowColor: "#000",
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.08,
                    shadowRadius: 8,
                    elevation: 2,
                    borderWidth: 1,
                    borderColor: "#e5e7eb",
                    width: "100%",
                    ...style,
                }}
            >
                {title && (
                    <Text
                        style={{
                            fontSize: 17,
                            fontWeight: "bold",
                            color: "#2563eb",
                            marginBottom: 10,
                            letterSpacing: 0.5,
                        }}
                    >
                        {title}
                    </Text>
                )}
                {children}
            </View>
        );
    }

    // --- Bank Details Section ---
    function renderBankDetailsSection() {
        if (!user?.user_type) return null;

        function renderSingleBankDetailsBlock(
            label: string,
            type: "admin" | "dealer" | "agent",
            details: BankDetails | undefined | null,
            canEdit: boolean,
            canAdd: boolean
        ) {
            const isEditing = editingBankDetails === type;
            const noBankDetails = !details?.bank_details;

            return (
                <Card title={label} key={type}>
                    {isBankDetailsLoading ? (
                        <ActivityIndicator color="#2563eb" size="small" />
                    ) : (
                        <>
                            <View style={{ minHeight: 40, marginBottom: 8 }}>
                                {details?.bank_details ? (
                                    <Text style={{ color: "#22223b", fontSize: 16, marginBottom: 2 }}>
                                        {details.bank_details}
                                    </Text>
                                ) : (
                                    <Text style={{ color: "#9ca3af", fontSize: 15 }}>No bank details added.</Text>
                                )}
                            </View>
                            {isEditing && (canEdit || (canAdd && noBankDetails)) ? (
                                <>
                                    <TextInput
                                        placeholder="Enter bank details"
                                        value={bankDetailsInput}
                                        onChangeText={setBankDetailsInput}
                                        style={{
                                            backgroundColor: "#f3f4f6",
                                            borderRadius: 8,
                                            borderWidth: 1,
                                            borderColor: "#cbd5e1",
                                            paddingHorizontal: 12,
                                            paddingVertical: 10,
                                            fontSize: 16,
                                            marginBottom: 8,
                                            minHeight: 60,
                                        }}
                                        multiline
                                        numberOfLines={3}
                                        placeholderTextColor="#9ca3af"
                                    />
                                    {bankDetailsError && (
                                        <Text style={{ color: "#dc2626", fontSize: 13, marginBottom: 6 }}>{bankDetailsError}</Text>
                                    )}
                                    <View style={{ flexDirection: "row", gap: 10 }}>
                                        <TouchableOpacity
                                            style={{
                                                backgroundColor: "#2563eb",
                                                paddingVertical: 10,
                                                paddingHorizontal: 22,
                                                borderRadius: 8,
                                                marginRight: 8,
                                            }}
                                            onPress={() => {
                                                if (!bankDetailsInput.trim()) {
                                                    setBankDetailsError("Bank details required");
                                                    return;
                                                }
                                                bankDetailsMutation.mutate({
                                                    type,
                                                    bank_details: bankDetailsInput.trim(),
                                                });
                                            }}
                                            activeOpacity={0.85}
                                        >
                                            <Text style={{ color: "#fff", fontWeight: "bold", fontSize: 15 }}>Save</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={{
                                                backgroundColor: "#f3f4f6",
                                                paddingVertical: 10,
                                                paddingHorizontal: 22,
                                                borderRadius: 8,
                                            }}
                                            onPress={() => {
                                                setEditingBankDetails(null);
                                                setBankDetailsInput("");
                                                setBankDetailsError(null);
                                            }}
                                            activeOpacity={0.85}
                                        >
                                            <Text style={{ color: "#22223b", fontWeight: "bold", fontSize: 15 }}>Cancel</Text>
                                        </TouchableOpacity>
                                    </View>
                                </>
                            ) : (
                                (canEdit || (canAdd && noBankDetails)) && (
                                    <TouchableOpacity
                                        style={{
                                            marginTop: 8,
                                            backgroundColor: "#e0e7ef",
                                            paddingVertical: 9,
                                            borderRadius: 8,
                                            alignItems: "center",
                                        }}
                                        onPress={() => {
                                            setEditingBankDetails(type);
                                            setBankDetailsInput(details?.bank_details || "");
                                        }}
                                        activeOpacity={0.85}
                                    >
                                        <Text style={{ color: "#2563eb", fontWeight: "bold", fontSize: 15 }}>
                                            {details?.bank_details
                                                ? (canEdit ? "Edit" : "Add")
                                                : "Add"} {label}
                                        </Text>
                                    </TouchableOpacity>
                                )
                            )}
                        </>
                    )}
                </Card>
            );
        }

        if (user.user_type === "ADMIN") {
            return renderSingleBankDetailsBlock(
                "My Bank Details",
                "admin",
                bankDetailsData?.admin_bank_details,
                true,
                true
            );
        } else if (user.user_type === "DEALER") {
            return (
                <>
                    {renderSingleBankDetailsBlock(
                        "Admin Bank Details",
                        "admin",
                        bankDetailsData?.admin_bank_details,
                        false,
                        false
                    )}
                    {renderSingleBankDetailsBlock(
                        "Dealer Bank Details",
                        "dealer",
                        bankDetailsData?.dealer_bank_details,
                        true,
                        true
                    )}
                </>
            );
        }
        return null;
    }

    // --- Prize Config Section ---
    function renderPrizeConfigSection() {
        if (user?.user_type !== "ADMIN") return null;

        if (isEditingPrizeConfig && prizeConfigForm) {
            return (
                <Card title="Edit Prize Configuration" key="prize-config-edit">
                    {PRIZE_CONFIG_FIELDS.map(({ key, label }) => (
                        <View key={key} style={{ marginBottom: 12 }}>
                            <Text style={{ color: "#22223b", fontSize: 15, marginBottom: 2 }}>{label}</Text>
                            <TextInput
                                value={prizeConfigForm[key]?.toString() ?? ""}
                                onChangeText={val => {
                                    setPrizeConfigForm(prev =>
                                        prev
                                            ? { ...prev, [key]: Number(val.replace(/[^0-9]/g, "")) }
                                            : prev
                                    );
                                }}
                                keyboardType="numeric"
                                style={{
                                    backgroundColor: "#f3f4f6",
                                    borderRadius: 8,
                                    borderWidth: 1,
                                    borderColor: "#cbd5e1",
                                    paddingHorizontal: 12,
                                    paddingVertical: 10,
                                    fontSize: 16,
                                }}
                                placeholder={`Enter ${label}`}
                                placeholderTextColor="#9ca3af"
                            />
                        </View>
                    ))}
                    {prizeConfigError && (
                        <Text style={{ color: "#dc2626", fontSize: 13, marginBottom: 6 }}>{prizeConfigError}</Text>
                    )}
                    <View style={{ flexDirection: "row", gap: 10, marginTop: 6 }}>
                        <TouchableOpacity
                            style={{
                                backgroundColor: "#2563eb",
                                paddingVertical: 10,
                                paddingHorizontal: 22,
                                borderRadius: 8,
                                marginRight: 8,
                            }}
                            onPress={() => {
                                if (
                                    !prizeConfigForm ||
                                    PRIZE_CONFIG_FIELDS.some(
                                        ({ key }) =>
                                            prizeConfigForm[key] === undefined ||
                                            prizeConfigForm[key] === null ||
                                            isNaN(Number(prizeConfigForm[key]))
                                    )
                                ) {
                                    setPrizeConfigError("All fields are required and must be numbers");
                                    return;
                                }
                                setPrizeConfigError(null);
                                prizeConfigMutation(prizeConfigForm);
                            }}
                            activeOpacity={0.85}
                            disabled={isPrizeConfigSaving}
                        >
                            {isPrizeConfigSaving ? (
                                <ActivityIndicator color="#fff" size="small" />
                            ) : (
                                <Text style={{ color: "#fff", fontWeight: "bold", fontSize: 15 }}>Save</Text>
                            )}
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={{
                                backgroundColor: "#f3f4f6",
                                paddingVertical: 10,
                                paddingHorizontal: 22,
                                borderRadius: 8,
                            }}
                            onPress={() => {
                                setIsEditingPrizeConfig(false);
                                setPrizeConfigError(null);
                            }}
                            activeOpacity={0.85}
                            disabled={isPrizeConfigSaving}
                        >
                            <Text style={{ color: "#22223b", fontWeight: "bold", fontSize: 15 }}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </Card>
            );
        }

        return (
            <Card title="Prize Configuration" key="prize-config">
                {isPrizeConfigLoading ? (
                    <ActivityIndicator color="#2563eb" size="small" />
                ) : prizeConfig ? (
                    <>
                        {PRIZE_CONFIG_FIELDS.map(({ key, label }) => (
                            <View key={key} style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
                                <Text style={{ color: "#22223b", fontSize: 15 }}>{label}</Text>
                                <Text style={{ color: "#2563eb", fontWeight: "bold", fontSize: 15 }}>
                                    ₹ {prizeConfig[key]?.toLocaleString("en-IN")}
                                </Text>
                            </View>
                        ))}
                        <TouchableOpacity
                            style={{
                                marginTop: 10,
                                backgroundColor: "#e0e7ef",
                                paddingVertical: 10,
                                borderRadius: 8,
                                alignItems: "center",
                            }}
                            onPress={() => {
                                setIsEditingPrizeConfig(true);
                                setPrizeConfigForm(prizeConfig);
                                setPrizeConfigError(null);
                            }}
                            activeOpacity={0.85}
                        >
                            <Text style={{ color: "#2563eb", fontWeight: "bold", fontSize: 15 }}>
                                Edit Prize Configuration
                            </Text>
                        </TouchableOpacity>
                    </>
                ) : (
                    <Text style={{ color: "#9ca3af", fontSize: 15 }}>No prize configuration found.</Text>
                )}
            </Card>
        );
    }

    // --- My Balance Section ---
    function renderMyBalanceSection() {
        if (user?.user_type === "AGENT" || user?.user_type === "DEALER") {
            return (
                <Card title="My Balance" key="my-balance">
                    {ismyBalanceLoading ? (
                        <ActivityIndicator color="#2563eb" size="small" />
                    ) : (
                        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                            <Text style={{ color: "#22223b", fontSize: 24, fontWeight: "bold" }}>
                                ₹ {myBalance?.balance_amount?.toLocaleString("en-IN") ?? "0"}
                            </Text>
                            <TouchableOpacity
                                onPress={() => refetchMyBalance()}
                                style={{
                                    marginLeft: 16,
                                    backgroundColor: "#e0e7ef",
                                    borderRadius: 8,
                                    paddingVertical: 7,
                                    paddingHorizontal: 18,
                                    flexDirection: "row",
                                    alignItems: "center",
                                }}
                                activeOpacity={0.8}
                                disabled={isFetchingMyBalance}
                            >
                                {isFetchingMyBalance ? (
                                    <ActivityIndicator size="small" color="#2563eb" />
                                ) : (
                                    <Text style={{ color: "#2563eb", fontWeight: "bold", fontSize: 15 }}>
                                        Refresh
                                    </Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    )}
                </Card>
            );
        }
        return null;
    }

    // --- Admin Tabs ---
    function renderAdminTabs() {
        if (user?.user_type !== "ADMIN") return null;
        const tabList = [
            { key: "bank", label: "Bank Details" },
            { key: "prize", label: "Prize Config" },
            { key: "toggle", label: "Activate" },
        ] as const;
        return (
            <View
                style={{
                    flexDirection: "row",
                    marginBottom: 18,
                    width: "100%",
                    justifyContent: "space-between",
                    backgroundColor: "#f3f4f6",
                    borderRadius: 12,
                    padding: 4,
                }}
            >
                {tabList.map(tab => (
                    <TouchableOpacity
                        key={tab.key}
                        style={{
                            flex: 1,
                            backgroundColor: activeSection === tab.key ? "#2563eb" : "transparent",
                            borderRadius: 8,
                            paddingVertical: 10,
                            marginHorizontal: 2,
                        }}
                        onPress={() => setActiveSection(tab.key)}
                        activeOpacity={0.85}
                    >
                        <Text
                            style={{
                                color: activeSection === tab.key ? "#fff" : "#2563eb",
                                fontWeight: "bold",
                                textAlign: "center",
                                fontSize: 16,
                                letterSpacing: 0.2,
                            }}
                        >
                            {tab.label}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>
        );
    }

    // --- Admin Toggle Section ---
    function renderAdminToggleSection() {
        if (user?.user_type !== "ADMIN") return null;
        const effectiveStatus = localStatus !== null ? localStatus : application_status;
        return (
            <Card>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                    <Text
                        style={{
                            fontSize: 16,
                            fontWeight: "bold",
                            color: effectiveStatus ? "#22c55e" : "#9ca3af",
                            letterSpacing: 1,
                        }}
                    >
                        {effectiveStatus ? "Active" : "Inactive"}
                    </Text>
                    <View style={{ flexDirection: "row", alignItems: "center" }}>
                        <Switch
                            value={effectiveStatus}
                            onValueChange={handleToggle}
                            disabled={
                                statusLoading ||
                                activateMutation.isPending ||
                                deactivateMutation.isPending
                            }
                            thumbColor={effectiveStatus ? "#4ade80" : "#ffffff"}
                            trackColor={{ false: "#d1d5db", true: "#bbf7d0" }}
                            ios_backgroundColor="#d1d5db"
                            style={{
                                transform: [{ scaleX: 1.15 }, { scaleY: 1.15 }],
                                marginLeft: 6,
                            }}
                        />
                        {statusLoading && (
                            <ActivityIndicator
                                size="small"
                                color={effectiveStatus ? "#4ade80" : "#d1d5db"}
                                style={{ marginLeft: 10 }}
                            />
                        )}
                    </View>
                </View>
            </Card>
        );
    }

    // --- Main Render ---
    return (
        <KeyboardAvoidingView
            style={{ flex: 1, backgroundColor: "#f3f4f6" }}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 24}
        >
            <ScrollView
                style={{ flex: 1, paddingHorizontal: 0, backgroundColor: "#f3f4f6" }}
                contentContainerStyle={{
                    justifyContent: "flex-start",
                    alignItems: "center",
                    flexGrow: 1,
                    paddingTop: 28,
                    paddingBottom: 44,
                    paddingHorizontal: 10,
                }}
                keyboardShouldPersistTaps="handled"
            >
                <View
                    style={{
                        width: "100%",
                        maxWidth: 420,
                        alignItems: "center",
                    }}
                >
                    {/* My Balance Section for Agent/Dealer */}
                    {renderMyBalanceSection()}

                    {/* Admin tab navigation */}
                    {user?.user_type === "ADMIN" && renderAdminTabs()}

                    {/* Section content based on tab for admin */}
                    {user?.user_type === "ADMIN" ? (
                        <>
                            {activeSection === "bank" && renderBankDetailsSection()}
                            {activeSection === "prize" && renderPrizeConfigSection()}
                            {activeSection === "toggle" && renderAdminToggleSection()}
                        </>
                    ) : (
                        renderBankDetailsSection()
                    )}
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}