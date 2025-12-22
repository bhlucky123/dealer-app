import api from '@/utils/axios'
import { useQuery } from '@tanstack/react-query'
import { ActivityIndicator, SafeAreaView, Text, View } from 'react-native'
import { WebView } from 'react-native-webview'

const Report = () => {
  const {
    data,
    isLoading,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ["/draw-booking/daily-report"],
    queryFn: async () => {
      const res = await api.get("/draw-result/sales-report-page/")
      return res.data
    },
  })

  // Expecting HTML in data.
  // If the API returns `{ html: "<html>...</html>" }` structure:
  // Change `data.html` to reflect actual property as needed, else just `data`

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View style={{ flex: 1 }}>
        {isLoading ? (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator size="large" color="#16a34a" />
            <Text style={{ marginTop: 10, color: "#333" }}>Loading Report...</Text>
          </View>
        ) : error ? (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
            <Text style={{ color: '#b91c1c', fontSize: 16, marginBottom: 12 }}>
              {error?.message || 'Failed to load report.'}
            </Text>
            <Text onPress={() => refetch()} style={{ color: "#1a73e8", fontWeight: "bold" }}>
              Tap to Retry
            </Text>
          </View>
        ) : data ? (
          <WebView
            originWhitelist={['*']}
            source={{ html: typeof data === "string" ? data : data.html || "" }}
            style={{ flex: 1, backgroundColor: 'transparent' }}
            javaScriptEnabled
            domStorageEnabled
            startInLoadingState
            scalesPageToFit
          />
        ) : (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <Text>No report to display.</Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  )
}

export default Report