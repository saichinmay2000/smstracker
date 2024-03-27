import React, { useState, useEffect } from 'react';
import { FlatList, Text, View, StyleSheet, PermissionsAndroid, ActivityIndicator, Button } from 'react-native';
import SmsAndroid from 'react-native-get-sms-android';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getTransactionInfo } from 'transaction-sms-parser'


const keywords = [
  'Spent on',
  'Payment of',
  'Received your Payment',
  'received a payment',
  'withdrawn from account',
  'withdrawn',
  'credited to a/c',
  'credited',
  'total amount due',
  'total paid amount',
  'amount due',
  'Sent Amount',
  'Installment amount of Rs.',
  'Installment amount'
];

// Amount (assuming currency is consistent)
const amountRegex = /(?:Rs\.|INR)\s*([0-9,.]+)/;
// const amountRegex = /(?:Rs|INR)\s*(\d{1,}(?:,\d{3})*(?:\.\d{2})?)/;

// Bank (Modify if you deal with multiple banks)
const bankRegex = /([A-Z]+\s*Bank)/i;

// Card Number
const cardRegex = /Card\s*(?:x|XX)(\d{4})\s*on/i;

// Transaction Type (Simple for this example)
const typeRegex = /(withdrawn|debited|spent)/i;

// Merchant/Location (can be tricky)
const merchantRegex = /at\s*(.*?)(?=\s*Avl Lmt:|$)/i;
// const merchantRegex = /at\s(.*?)(?=\. Updated Balance)/;

// Date 
const dateRegex = /(\d{2})-(\d{2})-(\d{2})/;

// Time
const timeRegex = /(\d{2}):(\d{2}):(\d{2})/;

// const smsText = "Rs.10000 withdrawn from HDFC Bank Card x6943 at +SIB ALMASGUDA on 2024-03-05:20:54:19 Avl bal: 5839.82.Not You? Call 18002586161/SMS BLOCK DC 6943 to 7308080808";

// ... (Regex definitions from above) ... 

const extractDetails = (sms) => {
  // ... (Matches for amount, bank, card, type, merchant, date, time) 
  // const amountMatch = amountRegex.match(sms); 
  const amountMatch = sms.match(amountRegex);
  const bankMatch = sms.match(bankRegex);
  const cardMatch = sms.match(cardRegex);
  const typeMatch = sms.match(typeRegex);
  const merchantMatch = sms.match(merchantRegex);
  const dateMatch = sms.match(dateRegex);
  const timeMatch = sms.match(timeRegex);

  return {
    amount: amountMatch ? parseFloat(amountMatch[1].replace(/,/g, '')) : null,
    bank: bankMatch ? bankMatch[1] : null,
    cardNumber: cardMatch ? cardMatch[1] : null,
    type: typeMatch ? typeMatch[1] : null,
    merchant: merchantMatch ? merchantMatch[1] : null,
    date: dateMatch ? `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}` : null,
    time: timeMatch ? `${timeMatch[1]}:${timeMatch[2]}:${timeMatch[3]}` : null
  };
}

const SMSTracker = () => {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    

    fetchTransactions();
    // console.log(transactions[5]["body"],"asasaas")
    // // console.log(getTransactionInfo(transactions[13]['body']));
    // const transactionDetails = extractDetails(transactions[5]['body']);
    // console.log(transactionDetails);
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

  const saveTransactionsToStorage = async (transactions) => {
    try {
      await AsyncStorage.setItem('transactions', JSON.stringify(transactions));
    } catch (error) {
      console.error('Error saving transactions to AsyncStorage:', error);
    }
  };

  const getTransactionsFromStorage = async () => {
    try {
      const storedTransactions = await AsyncStorage.getItem('transactions');
      console.log(storedTransactions,"stored");
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
    <View style={styles.item}>
      {/* <Text>{new Date(item.date).toLocaleString()}</Text> */}
      <Text style={styles.message}>Account: {extractDetails(item.body)["bank"]}</Text>
      <Text style={styles.message}>Amount: {extractDetails(item.body)["amount"]}</Text>
      <Text style={styles.message}>Date: {new Date(item.date).toLocaleDateString()}</Text>
      <Text style={styles.message}>Time: {new Date(item.date).toLocaleTimeString()}</Text>
      {/* <Text style={styles.message}>Account Number: {getTransactionInfo(item.body)['transaction']['type']}</Text> */}
      {/* <Text style={styles.message}>{item.body}</Text> */}
    </View>
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

export default SMSTracker;
