module.exports = {
  preset: "react-native",
  transform: { "^.+\\.(js|jsx|ts|tsx)$": "babel-jest" },
  transformIgnorePatterns: ["node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@react-navigation/.*|nativewind|react-native-css-interop|react-native-reanimated|zustand)"],
  moduleNameMapper: { "^@/(.*)$": "<rootDir>/$1" },
  testPathIgnorePatterns: ["/node_modules/", "/android/", "/ios/"],
};
