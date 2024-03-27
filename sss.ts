import React, { useState, useEffect } from 'react';
import { FlatList, Text, View, StyleSheet, PermissionsAndroid, ActivityIndicator, Button } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import SmsAndroid from 'react-native-get-sms-android';
import { getTransactionInfo } from 'transaction-sms-parser';

// Your existing code

const App = () => {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTransactions();
  }, []);

  const fetchTransactions = async () => {
    try {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.READ_SMS,
        {
          title: "Expense Tracker SMS Permission",
          message: "This app needs access to read your SMS for expense tracking.",
          buttonNeutral: "Ask Me Later",
          buttonNegative: "Cancel",
          buttonPositive: "OK"
        }
      );

      if (granted === PermissionsAndroid.RESULTS.GRANTED) {
        const filter = { box: 'inbox' };
        SmsAndroid.list(
          JSON.stringify(filter),
          (fail) => {
            console.log("Failed with this error: " + fail);
            setLoading(false);
          },
          async (count, smsList) => {
            const arr = JSON.parse(smsList);
            const filteredTransactions = arr.filter(object => {
              return keywords.some(keyword => object.body.toLowerCase().includes(keyword.toLowerCase()));
            });

            // Get existing transactions from AsyncStorage
            const storedTransactions = await getTransactionsFromStorage();

            // Filter out new transactions
            const newTransactions = filteredTransactions.filter(transaction => {
              return !storedTransactions.some(storedTransaction => storedTransaction.body === transaction.body);
            });

            // Save new transactions to AsyncStorage
            saveTransactionsToStorage([...storedTransactions, ...newTransactions]);

            setTransactions(filteredTransactions);
            setLoading(false);
          }
        );
      } else {
        console.log("SMS permission denied");
        setLoading(false);
      }
    } catch (err) {
      console.warn(err);
      setLoading(false);
    }
  };

  // Function to save transactions to AsyncStorage
  const saveTransactionsToStorage = async (transactions) => {
    try {
      await AsyncStorage.setItem('transactions', JSON.stringify(transactions));
    } catch (error) {
      console.error('Error saving transactions to AsyncStorage:', error);
    }
  };

  // Function to retrieve transactions from AsyncStorage
  const getTransactionsFromStorage = async () => {
    try {
      const storedTransactions = await AsyncStorage.getItem('transactions');
      return storedTransactions ? JSON.parse(storedTransactions) : [];
    } catch (error) {
      console.error('Error getting transactions from AsyncStorage:', error);
      return [];
    }
  };

  const refreshTransactions = async () => {
    fetchTransactions();
  };

  const renderTransaction = ({ item }) => (
    // Your existing code to render transactions
  );

  return (
    <View style={styles.container}>
      <View style={styles.refreshButton}>
        <Button title="Refresh" onPress={refreshTransactions} />
      </View>
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0000ff" />
          <Text>Loading</Text>
        </View>
      ) : (
        <FlatList
          data={transactions}
          renderItem={renderTransaction}
          keyExtractor={(item) => item.date}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20
  },
  item: {
    borderBottomWidth: 1,
    borderColor: '#ccc',
    padding: 10,
    marginBottom: 10
  },
  message: {
    fontWeight: 'bold'
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  refreshButton: {
    marginBottom: 10,
    alignSelf: 'flex-end'
  }
});

export default App;
