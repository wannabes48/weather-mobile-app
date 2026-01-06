import { FontAwesome5 } from '@expo/vector-icons'; // Using FontAwesome 5 to match your web icons
import AsyncStorage from '@react-native-async-storage/async-storage'; // For storing recent searches
import * as Location from 'expo-location';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Keyboard,
  RefreshControl,
  ScrollView,
  StyleSheet, Text,
  TextInput, TouchableOpacity,
  View
} from 'react-native';

const { width } = Dimensions.get('window');

export default function App() {
  const [weather, setWeather] = useState(null);
  const [locationName, setLocationName] = useState('My Location');
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [recentSearches, setRecentSearches] = useState([]);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Update time every minute (like your web app)
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    loadRecentSearches();
    return () => clearInterval(timer);
  }, []);

  // Load recent searches from storage
  const loadRecentSearches = async () => {
    try {
      const saved = await AsyncStorage.getItem('recentSearches');
      if (saved) setRecentSearches(JSON.parse(saved));
    } catch (e) { console.log('Failed to load history'); }
  };

  // Save recent search
  const saveRecentSearch = async (city) => {
    try {
      const newHistory = [city, ...recentSearches.filter(c => c !== city)].slice(0, 5);
      setRecentSearches(newHistory);
      await AsyncStorage.setItem('recentSearches', JSON.stringify(newHistory));
    } catch (e) { console.log('Failed to save history'); }
  };

  const weatherDescriptions = {
    0: "Clear sky", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast",
    45: "Foggy", 48: "Depositing rime fog",
    51: "Light drizzle", 53: "Moderate drizzle", 55: "Dense drizzle",
    61: "Slight rain", 63: "Moderate rain", 65: "Heavy rain",
    95: "Thunderstorm"
  };

  const fetchWeather = async (lat, lon, city) => {
    setLoading(true);
    try {
      const response = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,surface_pressure,wind_speed_10m,uv_index,visibility,dew_point_2m`
      );
      if (!response.ok) throw new Error("Weather data unavailable");
      const data = await response.json();
      
      setWeather(data.current);
      setLocationName(city);
      if (city !== "My Location") saveRecentSearch(city);
    } catch (error) {
      Alert.alert("Error", error.message);
    } finally {
      setLoading(false);
    }
  };

  const searchCity = async (cityToSearch) => {
    const query = cityToSearch || searchQuery;
    if (!query.trim()) return;
    Keyboard.dismiss();
    setLoading(true);

    try {
      const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${query}&count=1`);
      const data = await response.json();
      if (!data.results?.length) throw new Error("Location not found");

      const { latitude, longitude, name, country } = data.results[0];
      const fullName = `${name}, ${country}`;
      fetchWeather(latitude, longitude, fullName);
      setSearchQuery('');
    } catch (error) {
      Alert.alert("Error", "City not found");
      setLoading(false);
    }
  };

  const getCurrentLocation = async () => {
    setLoading(true);
    let { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return setLoading(false);

    let loc = await Location.getCurrentPositionAsync({});
    let reverse = await Location.reverseGeocodeAsync({
      latitude: loc.coords.latitude,
      longitude: loc.coords.longitude
    });
    
    // Fallback if reverse geocoding returns null for city
    let cityName = reverse[0]?.city || reverse[0]?.region || "My Location";
    fetchWeather(loc.coords.latitude, loc.coords.longitude, cityName);
  };

  // Initial Load
  useEffect(() => { getCurrentLocation(); }, []);

  // Render a Grid Item (matching your .weather-item div)
  const WeatherItem = ({ icon, label, value }) => (
    <View style={styles.weatherItem}>
      <View style={styles.iconContainer}>
        <FontAwesome5 name={icon} size={24} color="#555" />
      </View>
      <View style={styles.itemContent}>
        <Text style={styles.itemLabel}>{label}</Text>
        <Text style={styles.itemValue}>{value}</Text>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header Area */}
      <View style={styles.header}>
        <Text style={styles.appTitle}>Weather App</Text>
        <Text style={styles.timeText}>
          {currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <TextInput 
          style={styles.inputField}
          placeholder="Enter city name..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          onSubmitEditing={() => searchCity()}
        />
        <TouchableOpacity style={styles.searchBtn} onPress={() => searchCity()}>
          <FontAwesome5 name="search" size={16} color="#fff" />
          <Text style={styles.btnText}>Search</Text>
        </TouchableOpacity>
      </View>

      {/* Recent Searches (Horizontal Scroll) */}
      {recentSearches.length > 0 && (
        <View style={styles.recentContainer}>
          <Text style={styles.recentTitle}>Recent:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {recentSearches.map((city, index) => (
              <TouchableOpacity key={index} style={styles.recentChip} onPress={() => searchCity(city)}>
                <FontAwesome5 name="history" size={12} color="#666" style={{marginRight:5}} />
                <Text style={styles.recentText}>{city.split(',')[0]}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Main Content */}
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={getCurrentLocation} />}
      >
        {loading && !weather ? (
          <ActivityIndicator size="large" color="#0000ff" style={{marginTop: 50}} />
        ) : weather ? (
          <View style={styles.weatherContainer}>
            <Text style={styles.cityName}>{locationName}</Text>
            <Text style={styles.dateText}>
              {currentTime.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </Text>

            {/* Weather Grid */}
            <View style={styles.weatherGrid}>
              <WeatherItem icon="temperature-high" label="Temperature" value={`${weather.temperature_2m}°C`} />
              <WeatherItem icon="cloud" label="Condition" value={weatherDescriptions[weather.weather_code] || "Unknown"} />
              <WeatherItem icon="wind" label="Wind" value={`${weather.wind_speed_10m} km/h`} />
              <WeatherItem icon="sun" label="UV Index" value={weather.uv_index} />
              <WeatherItem icon="tint" label="Humidity" value={`${weather.relative_humidity_2m}%`} />
              <WeatherItem icon="thermometer-half" label="Dew Point" value={`${weather.dew_point_2m}°C`} />
              <WeatherItem icon="tachometer-alt" label="Pressure" value={`${Math.round(weather.surface_pressure)} hPa`} />
              <WeatherItem icon="eye" label="Visibility" value={`${weather.visibility / 1000} km`} />
            </View>
          </View>
        ) : null}
      </ScrollView>

      {/* Footer / Copyright */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>© 2026 Weather App | Powered by Open-Meteo</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f2f5', paddingTop: 40 },
  header: { paddingHorizontal: 20, marginBottom: 15, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  appTitle: { fontSize: 24, fontWeight: 'bold', color: '#333' },
  timeText: { fontSize: 16, color: '#666', fontWeight: '500' },
  
  searchContainer: { flexDirection: 'row', paddingHorizontal: 20, marginBottom: 15 },
  inputField: { flex: 1, backgroundColor: '#fff', borderRadius: 8, padding: 12, marginRight: 10, elevation: 2 },
  searchBtn: { backgroundColor: '#007bff', borderRadius: 8, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', elevation: 2 },
  btnText: { color: '#fff', fontWeight: 'bold', marginLeft: 8 },

  recentContainer: { paddingHorizontal: 20, marginBottom: 15, flexDirection: 'row', alignItems: 'center' },
  recentTitle: { fontSize: 14, color: '#666', marginRight: 10 },
  recentChip: { flexDirection: 'row', backgroundColor: '#e9ecef', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 15, marginRight: 8, alignItems: 'center' },
  recentText: { fontSize: 13, color: '#495057' },

  scrollContent: { paddingBottom: 20 },
  weatherContainer: { paddingHorizontal: 20 },
  cityName: { fontSize: 28, fontWeight: 'bold', color: '#2c3e50', textAlign: 'center', marginBottom: 5 },
  dateText: { fontSize: 14, color: '#7f8c8d', textAlign: 'center', marginBottom: 25 },

  weatherGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  weatherItem: { 
    width: (width - 50) / 2, // 2 columns with spacing
    backgroundColor: '#fff', 
    borderRadius: 12, 
    padding: 15, 
    marginBottom: 15, 
    flexDirection: 'row', 
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 3
  },
  iconContainer: { width: 40, alignItems: 'center' },
  itemContent: { flex: 1, marginLeft: 10 },
  itemLabel: { fontSize: 12, color: '#95a5a6', marginBottom: 2 },
  itemValue: { fontSize: 16, fontWeight: 'bold', color: '#2c3e50' },

  footer: { padding: 20, alignItems: 'center', borderTopWidth: 1, borderTopColor: '#e0e0e0', marginTop: 'auto' },
  footerText: { fontSize: 12, color: '#999' }
});