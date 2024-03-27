import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useState, useEffect } from 'react';
import { FlatList, Text, View, StyleSheet, PermissionsAndroid, ActivityIndicator, Button, TouchableOpacity, Modal, TextInput } from 'react-native';
import SmsAndroid from 'react-native-get-sms-android';
import { v4 as uuid } from 'uuid'

const CHUNK_SIZE = 100000;

const keywords = [
    'spent on',
    'payment of',
    'received your payment',
    'received a payment',
    'withdrawn from account',
    'withdrawn',
    'credited to a/c',
    'credited',
    'total amount due',
    'total paid amount',
    'amount due',
    'sent amount',
    'installment amount of rs.',
    'installment amount',
    'debited INR'
];

export default function SMSTracker() {
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [open, setOpen] = useState(false)
    const [selectedTransaction, setSelectedTransaction] = useState(null);
    const [categoryInput, setCategoryInput] = useState('');
    const [merchantInput, setMerchantInput] = useState('');


    useEffect(() => {
        loadTransactionsFromStorage();
        fetchTransactions();
    }, []);

    const handleUpdateTransaction = async () => {
        if (selectedTransaction) {
            try {
                // Load existing transactions from AsyncStorage
                const existingTransactions = await loadTransactionsFromStorage();

                // Find the index of the selected transaction in existing transactions
                const selectedIndex = existingTransactions.findIndex(transaction => transaction.id === selectedTransaction.id);

                if (selectedIndex !== -1) {
                    // Update the category and merchant of the selected transaction
                    existingTransactions[selectedIndex].category = categoryInput;
                    existingTransactions[selectedIndex].merchant = merchantInput;

                    // Save the updated transactions back to AsyncStorage
                    await AsyncStorage.setItem('transactions', JSON.stringify(existingTransactions));

                    // Update the state to reflect the changes in the UI
                    setTransactions(existingTransactions);
                    console.log(existingTransactions, "LOGEXI");
                }

                // Close the modal
                setOpen(false);
            } catch (error) {
                console.error('Error updating transaction:', error);
            }
        }
    };

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
                        }).map(parseTransaction);

                        // setTransactions(filteredTransactions);
                        const simplifiedTransactions = filteredTransactions.map(transaction => ({
                            id: transaction.id,
                            amount: transaction.amount,
                            accountNumber: transaction.accountNumber,
                            bankName: transaction.bankName,
                            date: transaction.date,
                            type: transaction.type,
                            category: transaction.category,
                            merchant: transaction.merchant
                        }));
                        // for (let i = 0; i < filteredTransactions.length; i += CHUNK_SIZE) {
                        //     const chunk = filteredTransactions.slice(i, i + CHUNK_SIZE);
                        //     await AsyncStorage.setItem(`transactions_${i}`, JSON.stringify(chunk));
                        // }

                        const existingTransactions = await loadTransactionsFromStorage();

                        const updatedTransactions = [...existingTransactions, ...simplifiedTransactions];

                        await AsyncStorage.setItem('transactions', JSON.stringify(updatedTransactions));
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

    const parseTransaction = (sms) => {
        const amount = parseAmount(sms.body);
        const accountNumber = parseAccountNumber(sms.body);
        const bankName = parseBankName(sms.body);
        const date = new Date(sms.date)
        const type = parseTransactionType(sms.body);
        const category = categorizeSMS(sms.body)
        const merchant = extractMerchantsFromSMS(sms.body)[0];

        return {
            id: uuid(),
            amount,
            accountNumber,
            bankName,
            date,
            type,
            category,
            merchant,
            rawMessage: sms.body
        };
    };

    const parseAmount = (message) => {
        const regex = /(?:Rs\.\s*)?([\d,]+(?:\.\d{1,2})?)/i; // Matches amounts with commas and up to two decimal places
        const match = message.match(regex);
        if (match) {
            // Remove commas and parse as float
            const amountWithoutCommas = match[1].replace(/,/g, '');
            return parseFloat(amountWithoutCommas);
        } else {
            return null;
        }
    };

    const parseAccountNumber = (rawMessage) => {
        if (rawMessage && rawMessage.includes('HDFC') && rawMessage.includes('credited to your card ending')) {
            const accountNumberRegex = /ending\s+(\d{4,})/; // Regex to match "ending" followed by a sequence of 4 or more digits
            const match = rawMessage.match(accountNumberRegex);

            if (match && match[1]) {
                return match[1];
            }
        } else {
            if (rawMessage && rawMessage.includes('UPI')) {
                return 'UPI';
            }

            const accountNumberRegex = /\b(\d{4})\b/g; // Regex to match a sequence of 4 digits
            const matches = rawMessage.match(accountNumberRegex);

            if (matches && matches.length > 0) {
                // Return the last match found
                return matches[matches.length - 1];
            }
        }

        return 'Unknown';
    };

    const parseBankName = (message) => {
        const bankNames = [
            "Amex",
            "American Express",
            "Allahabad Bank",
            "Andhra Bank",
            "Axis Bank",
            "Bandhan Bank",
            "Bank of Baroda",
            "Bank of India",
            "Bank of Maharashtra",
            "Catholic Syrian Bank",
            "Canara Bank",
            "Central Bank of India",
            "Citibank",
            "City Union Bank",
            "Corporation Bank",
            "DBS Bank",
            "DCB Bank",
            "Dena Bank",
            "Deutsche Bank",
            "Dhanlaxmi Bank",
            "FEDERAL BANK",
            "HDFC Bank",
            "HSBC",
            "ICICI Bank",
            "IDBI Bank",
            "IDFC Bank",
            "India Post",
            "Indian Overseas Bank",
            "Karnataka Bank",
            "Karur Vysya Bank",
            "Lakshmi Vilas Bank",
            "Oriental Bank of Commerce",
            "Indian Bank",
            "IndusInd Bank",
            "Jammu and Kashmir Bank",
            "Kotak Mahindra Bank",
            "PMC Bank",
            "PSB Bank",
            "Saraswat Bank",
            "Punjab National Bank",
            "OBC",
            "RBL Bank",
            "Royal Bank of Scotland",
            "Standard Chartered Bank",
            "State Bank of Hyderabad",
            "State Bank of Mysore",
            "State Bank of Patiala",
            "State Bank of Travancore",
            "State Bank of India",
            "SBI TATA",
            "Syndicate Bank",
            "UCO Bank",
            "United Bank of India",
            "Vijaya Bank",
            "SBI Credit Card",
            "YES Bank"
        ]; // Add more bank names as needed
        const regex = new RegExp(`\\b(${bankNames.join("|")})\\b`, "i"); // Matches any of the bank names (case-insensitive)
        const match = message.match(regex);
        return match ? match[0] : null;
    };

    const parseTransactionType = (message) => {
        // Check for keywords indicating debit or credit
        const lowerCaseMessage = message.toLowerCase();
        if (lowerCaseMessage.includes('debited') || lowerCaseMessage.includes('withdrawn') || lowerCaseMessage.includes('spent')) {
            return 'Debit';
        } else if (lowerCaseMessage.includes('credited') || lowerCaseMessage.includes('received') || lowerCaseMessage.includes('paid')) {
            return 'Credit';
        } else {
            return 'Unknown';
        }
    };

    const extractMerchantsFromSMS = (smsText) => {
        const merchants = [
            "ACT Broadband", "Aircel", "Airtel", "Airtel Money", "Airtel payments bank", "Amazon Pay",
            "Axis Wallet", "BookMyShow", "BSNL", "Cleartrip", "FreeCharge", "GoIbibo", "ICICI Meal Card",
            "HDFC foodcard", "Forex cards", "ICICI Multi-Wallet Card", "Idea", "Infosys SmartCard (iMoney)",
            "IRCTC", "JioMoney Wallet", "MakeMyTrip", "Mobikwik", "Olacabs", "Ola Money", "Paytm", "PayZapp",
            "ICICI Pockets", "Reliance Mobile", "Sodexo", "Ticket Restaurant", "Vodafone", "Yatra", "Zeta",
            "Google Pay", "ePayLater", "Simpl", "Netflix", "Hotstar", "Amazon prime", "Bigbazaar Future Pay",
            "Dish TV", "Sun", "Tata Sky", "Videocon", "Adani Gas", "APEPDCL", "APSPDCL", "BESCOM", "BSES",
            "CESC", "DHBVN", "Gujarat Gas", "GUVNL", "Mahanagar Gas", "MSEDCL", "PSPCL", "Sabarmati Gas",
            "TANGEDCO (TNEB)", "TATA Power", "TSSPDCL", "UHBVN", "UPPCL", "HDFC Life", "ICICI Prudential",
            "Kotak Life", "Reliance life", "LIC", "MAX Life", "SBI Life", "Jio", "Airtribe Private", "IND*Amazon", "SIB", "Smart Point", "Malabar Gold", "Subbayya Gari", "Metro Cash", "Pet Mart", "Hyderabad Metro", "Pizza Hut", "Tata Motors", "Bharat Petroleum", "HungerBox", "Bharat Petroleu", "Reliance Trends", "Apollo Pharmacy",
            , "Reliance Re", "South India", "The Chennai", "Vishal Mega Mart", "ESSAR R R Fuels", "MC Donalds", "YAY Foods"
        ];


        const lowercasedMerchants = merchants.map(merchant => merchant.toLowerCase());


        const foundMerchants = [];

        lowercasedMerchants.forEach(merchant => {
            if (smsText.toLowerCase().includes(merchant)) {
                foundMerchants.push(merchant);
            }
        });

        return foundMerchants.map(merchant => merchants[lowercasedMerchants.indexOf(merchant)]);
    };

    const categorizeSMS = (smsText) => {
        const keywordsWithCategories = [
            { keyword: "ACT Broadband", category: "Businesses, Services, Wallets" },
            { keyword: "Aircel", category: "Businesses, Services, Wallets" },
            { keyword: "Airtel", category: "Businesses, Services, Wallets" },
            { keyword: "Airtel Money", category: "Businesses, Services, Wallets" },
            { keyword: "Airtel payments bank", category: "Businesses, Services, Wallets" },
            { keyword: "Amazon Pay", category: "Businesses, Services, Wallets" },
            { keyword: "Axis Wallet", category: "Businesses, Services, Wallets" },
            { keyword: "BookMyShow", category: "Businesses, Services, Wallets" },
            { keyword: "BSNL", category: "Businesses, Services, Wallets" },
            { keyword: "Cleartrip", category: "Businesses, Services, Wallets" },
            { keyword: "FreeCharge", category: "Businesses, Services, Wallets" },
            { keyword: "GoIbibo", category: "Businesses, Services, Wallets" },
            { keyword: "ICICI Meal Card", category: "Businesses, Services, Wallets" },
            { keyword: "HDFC foodcard", category: "Businesses, Services, Wallets" },
            { keyword: "Forex cards", category: "Businesses, Services, Wallets" },
            { keyword: "ICICI Multi-Wallet Card", category: "Businesses, Services, Wallets" },
            { keyword: "Idea", category: "Businesses, Services, Wallets" },
            { keyword: "Infosys SmartCard (iMoney)", category: "Businesses, Services, Wallets" },
            { keyword: "IRCTC", category: "Businesses, Services, Wallets" },
            { keyword: "JioMoney Wallet", category: "Businesses, Services, Wallets" },
            { keyword: "MakeMyTrip", category: "Businesses, Services, Wallets" },
            { keyword: "Mobikwik", category: "Businesses, Services, Wallets" },
            { keyword: "Olacabs", category: "Businesses, Services, Wallets" },
            { keyword: "Ola Money", category: "Businesses, Services, Wallets" },
            { keyword: "Paytm", category: "Businesses, Services, Wallets" },
            { keyword: "PayZapp", category: "Businesses, Services, Wallets" },
            { keyword: "ICICI Pockets", category: "Businesses, Services, Wallets" },
            { keyword: "Reliance Mobile", category: "Businesses, Services, Wallets" },
            { keyword: "Sodexo", category: "Businesses, Services, Wallets" },
            { keyword: "Ticket Restaurant", category: "Businesses, Services, Wallets" },
            { keyword: "Vodafone", category: "Businesses, Services, Wallets" },
            { keyword: "Yatra", category: "Businesses, Services, Wallets" },
            { keyword: "Zeta", category: "Businesses, Services, Wallets" },
            { keyword: "Google Pay", category: "Businesses, Services, Wallets" },
            { keyword: "ePayLater", category: "Businesses, Services, Wallets" },
            { keyword: "Simpl", category: "Businesses, Services, Wallets" },
            { keyword: "Netflix", category: "Businesses, Services, Wallets" },
            { keyword: "Hotstar", category: "Businesses, Services, Wallets" },
            { keyword: "Amazon prime", category: "Businesses, Services, Wallets" },
            { keyword: "Bigbazaar Future Pay", category: "Businesses, Services, Wallets" },
            { keyword: "Airtribe", category: "Businesses, Services, Wallets" },
            { keyword: "Airtribe Private Limited", category: "Businesses, Services, Wallets" },
            { keyword: "Tata Motors", category: "Businesses, Services, Wallets" },
            { keyword: "HungerBox", category: "Businesses, Services, Wallets" },
            // { keyword: "CRED", category: "Businesses, Services, Wallets" },
            { keyword: "Reliance Re", category: "Businesses, Services, Wallets" },

            { keyword: "Airtel", category: "DTH & Mobile billers" },
            { keyword: "Dish TV", category: "DTH & Mobile billers" },
            { keyword: "Sun", category: "DTH & Mobile billers" },
            { keyword: "Tata Sky", category: "DTH & Mobile billers" },
            { keyword: "Videocon", category: "DTH & Mobile billers" },
            { keyword: "Vodafone", category: "DTH & Mobile billers" },
            { keyword: "BSNL", category: "DTH & Mobile billers" },
            { keyword: "Reliance Jio", category: "DTH & Mobile billers" },
            { keyword: "Jio", category: "DTH & Mobile billers" },

            { keyword: "Adani Gas", category: "Utilities (Gas, Electricity)" },
            { keyword: "Filling", category: "Utilities (Gas, Electricity, Fuel)" },
            { keyword: "Petroleum", category: "Utilities (Gas, Electricity, Fuel)" },
            { keyword: "Petroleu", category: "Utilities (Gas, Electricity, Fuel)" },
            { keyword: "Fuels", category: "Utilities (Gas, Electricity, Fuel)" },
            { keyword: "Fuel", category: "Utilities (Gas, Electricity, Fuel)" },
            { keyword: "APEPDCL", category: "Utilities (Gas, Electricity)" },
            { keyword: "APSPDCL", category: "Utilities (Gas, Electricity)" },
            { keyword: "TSSPDCL", category: "Utilities (Gas, Electricity)" },
            // Add more keywords along with their categories
            { keyword: "HDFC Life", category: "Insurance" },
            { keyword: "ICICI Prudential", category: "Insurance" },
            { keyword: "IND*Amazon", category: "Shopping" },
            { keyword: "Metro Cash", category: "Shopping" },
            { keyword: "The Chennai", category: "Shopping" },
            { keyword: "Vishal Mega Mart", category: "Shopping" },
            { keyword: "Metro Cash and Carry", category: "Shopping" },
            { keyword: "Reliance Trends", category: "Shopping" },
            { keyword: "Smart Point", category: "Shopping" },
            { keyword: "Malabar Gold", category: "Shopping" },
            { keyword: "South India", category: "Shopping" },
            { keyword: "Subbayya Gari", category: "Food" },
            { keyword: "Pizza Hut", category: "Food" },
            { keyword: "MC Donalds", category: "Food" },
            { keyword: "Foods", category: "Food" },
            { keyword: "Pet Mart", category: "Grocery" },
            { keyword: "Hyderabad Metro", category: "Travel" },
            { keyword: "Apollo Pharmacy", category: "General" },
            // Add more keywords along with their categories
        ];

        for (const { keyword, category } of keywordsWithCategories) {
            if (smsText.toLowerCase().includes(keyword.toLowerCase())) {
                return category;
            }
        }

        return "Other"; // Default category for no match
    };

    const renderTransaction = ({ item }) => {
        // console.log(item,"AJKAJK");
        if (item.bankName && item.amount) {
            return (
                <TouchableOpacity onPress={() => handleItemClick(item)}>
                    <View style={styles.item}>

                        <Text style={styles.message}>Amount: ₹ {item.amount}</Text>
                        <Text style={styles.message}>Account Number: {item.accountNumber}</Text>
                        <Text style={styles.message}>Bank Name: {item.bankName}</Text>
                        <Text style={styles.message}>Date: {new Date(item.date).toLocaleDateString()}</Text>
                        <Text style={styles.message}>Type: {item.type}</Text>
                        <Text style={styles.message}>Merchant: {extractMerchantsFromSMS(item.rawMessage)}</Text>
                        <Text style={styles.message}>Category: {categorizeSMS(item.rawMessage)}</Text>
                        {/* <Text style={styles.message}>Message: {item.rawMessage}</Text> */}

                    </View>
                </TouchableOpacity>
            );
        } else {
            return null; // or any other fallback rendering
        }
    };

    const handleItemClick = (transaction) => {
        console.log(transaction, "ASA");
        setSelectedTransaction(transaction);
        setCategoryInput(transaction.category || ''); // Populate inputs with existing values
        setMerchantInput(transaction.merchant || '');
        setOpen(true);
    };

    const loadTransactionsFromStorage = async () => {
        let transactions = [];
        try {
            let i = 0;
            let chunk = await AsyncStorage.getItem(`transactions_${i}`);
            while (chunk !== null) {
                transactions = [...transactions, ...JSON.parse(chunk)];
                i++;
                chunk = await AsyncStorage.getItem(`transactions_${i}`);
                setTransactions(transactions)
            }
        } catch (error) {
            console.error('Error loading transactions from AsyncStorage:', error);
        }
        return transactions;
    };

    return (
        <View style={styles.container}>
            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#0000ff" />
                    <Text>Loading</Text>
                </View>
            ) : (
                <FlatList
                    data={transactions}
                    renderItem={renderTransaction}
                    keyExtractor={item => item.id.toString()}
                    refreshing={loading}
                    onRefresh={fetchTransactions}
                />
            )}
            <Modal
                animationType="slide"
                transparent={true}
                visible={open}
                onRequestClose={() => setOpen(false)}
            >
                <View style={styles.modalContainer}>
                    <View style={styles.modalContent}>
                        <Text>Update Transaction Details</Text>
                        <TextInput
                            placeholder="Category"
                            value={categoryInput}
                            onChangeText={setCategoryInput}
                            style={styles.input}
                        />
                        <TextInput
                            placeholder="Merchant"
                            value={merchantInput}
                            onChangeText={setMerchantInput}
                            style={styles.input}
                        />
                        <Button title="Update" onPress={handleUpdateTransaction} />
                    </View>
                </View>
            </Modal>
        </View>
    );
}

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
    modalContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.5)' // Semi-transparent background
    },
    modalContent: {
        backgroundColor: '#fff',
        padding: 20,
        borderRadius: 10,
        width: '80%'
    },
    input: {
        borderWidth: 1,
        borderColor: '#ccc',
        borderRadius: 5,
        padding: 10,
        marginBottom: 10
    }
});
