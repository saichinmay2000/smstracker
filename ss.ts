import React, { useState, useEffect } from 'react';
import { FlatList, Text, View, StyleSheet, PermissionsAndroid, ActivityIndicator, Button, Image, TextInput } from 'react-native';
import SmsAndroid from 'react-native-get-sms-android';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DatePicker from 'react-native-date-picker'
import moment from 'moment'
import Modal from 'react-native-modal';
import { Picker } from '@react-native-picker/picker';




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

const bankLogos = {
    "hdfcbank": "https://e7.pngegg.com/pngimages/257/159/png-clipart-hdfc-logo-thumbnail-bank-logos.png",
    "icicibank": "https://e7.pngegg.com/pngimages/892/32/png-clipart-icici-bank-logo-bank-logos-thumbnail.png"
}

// Amount (assuming currency is consistent)
// const amountRegex = /(?:Rs\.|INR)\s*([0-9,.]+)/;
// // const amountRegex = /(?:Rs|INR)\s*(\d{1,}(?:,\d{3})*(?:\.\d{2})?)/;

// // Bank (Modify if you deal with multiple banks)
// const bankRegex = /([A-Z]+\s*Bank)/i;

// // Card Number
// const cardRegex = /Card\s*(?:x|XX)(\d{4})\s*on/i;

// // Transaction Type (Simple for this example)
// const typeRegex = /(withdrawn|debited|spent|paid|credit|debit)/i;

// // Merchant/Location (can be tricky)
// const merchantRegex = /at\s*(.*?)(?=\s*Avl Lmt:|$)/i;
// // const merchantRegex = /at\s(.*?)(?=\. Updated Balance)/;

// // Date 
// const dateRegex = /(\d{2})-(\d{2})-(\d{2})/;

// // Time
// const timeRegex = /(\d{2}):(\d{2}):(\d{2})/;

// const extractDetails = (sms) => {
//     // ... (Matches for amount, bank, card, type, merchant, date, time) 
//     // const amountMatch = amountRegex.match(sms); 
//     const amountMatch = sms.match(amountRegex);
//     const bankMatch = sms.match(bankRegex);
//     const cardMatch = sms.match(cardRegex);
//     const typeMatch = sms.match(typeRegex);
//     const merchantMatch = sms.match(merchantRegex);
//     const dateMatch = sms.match(dateRegex);
//     const timeMatch = sms.match(timeRegex);

//     return {
//         amount: amountMatch ? parseFloat(amountMatch[1].replace(/,/g, '')) : null,
//         bank: bankMatch ? bankMatch[1] : null,
//         cardNumber: cardMatch ? cardMatch[1] : null,
//         type: typeMatch ? typeMatch[1] : null,
//         merchant: merchantMatch ? merchantMatch[1] : null,
//         date: dateMatch ? `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}` : null,
//         time: timeMatch ? `${timeMatch[1]}:${timeMatch[2]}:${timeMatch[3]}` : null
//     };
// }

const SMSTracker = () => {
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [open, setOpen] = useState(false)
    const [filteredTransactions, setFilteredTransactions] = useState([]);
    const [showManualInput, setShowManualInput] = useState(false);
    const [manualTransaction, setManualTransaction] = useState({
        category: '',
        title: '',
        amountin: '',
        date: new Date().toISOString() // Initialize date with current date
    });


    useEffect(() => {


        fetchTransactions();
        // console.log(transactions[5]["body"],"asasaas")
        // // console.log(getTransactionInfo(transactions[13]['body']));
        // const transactionDetails = extractDetails(transactions[5]['body']);
        // console.log(transactionDetails);
    }, []);

    useEffect(() => {
        // filterTransactionsByDate();
    }, [selectedDate, transactions]);

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

    // const filterTransactionsByDate = () => {
    //     const selectedDateString = moment(selectedDate).format("DD-MM-YY");
    //     const filtered = transactions.filter(transaction => {
    //         const transactionDate = extractDetails(transaction.body).date;
    //         return transactionDate === selectedDateString;
    //     });
    //     setFilteredTransactions(filtered);
    // };

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
            console.log(storedTransactions, "stored");
            return storedTransactions ? JSON.parse(storedTransactions) : [];
        } catch (error) {
            console.error('Error getting transactions from AsyncStorage:', error);
            return [];
        }
    };

    const handleManualTransactionSubmit = () => {
        // Perform validation on manualTransaction object if required
        // Add manualTransaction to transactions state
        setTransactions([...transactions, manualTransaction]);
        // Close the manual input modal
        setShowManualInput(false);
    };

    // const refreshTransactions = async () => {
    //     fetchTransactions();
    // };

    const renderTransaction = ({ item }) => {

        // const bankName = extractDetails(item.body)["bank"];
        // if(bankName!==null){
        //     var processedBankName = bankName.toLowerCase().replace(/\s/g, '');
        // } // Convert to lowercase and remove spaces
        // const logoUrl = bankLogos[processedBankName] || 'https://example.com/default_logo.png';
        // console.log(logoUrl,"urlr");
        // const merchant = extractDetails(item.body)["merchant"];
        // const isUPI = item.body.toLowerCase().includes('upi');
        
        if(1===1){
            return(
                <View style={styles.item}>
                {/* <Text>{new Date(item.date).toLocaleString()}</Text> */}
                {/* <Image source={{ uri: logoUrl }} style={styles.bankLogo} /> */}
                {/* <Text style={styles.message}>Merchant: {extractDetails(item.body)["merchant"]}</Text>
                <Text style={styles.message}>Account: {extractDetails(item.body)["bank"]}</Text>
                <Text style={styles.message}>Amount: {extractDetails(item.body)["amount"]}</Text>
                <Text style={styles.message}>Type: {extractDetails(item.body)["type"]}</Text> */}
                <Text style={styles.message}>Merchant: {item.body}</Text>
                <Text style={styles.message}>Date: {new Date(item.date).toLocaleDateString()}</Text>
                <Text style={styles.message}>Time: {new Date(item.date).toLocaleTimeString()}</Text>
                {/* {isUPI && <Text style={styles.message}>Paid via UPI</Text>} */}
                {/* <Text style={styles.message}>Account Number: {getTransactionInfo(item.body)['transaction']['type']}</Text> */}
                {/* <Text style={styles.message}>{item.body}</Text> */}
            </View>
            )
        }
    };

    return (
        <View style={styles.container}>
            <View style={styles.refreshButton}>
            <Button title="Add Manual Transaction" onPress={() => setShowManualInput(true)} />
            <Modal visible={showManualInput} animationType="slide">
                <View style={styles.modalContainer}>
                    <Picker
                        selectedValue={manualTransaction.category}
                        style={styles.picker}
                        onValueChange={(itemValue) =>
                            setManualTransaction({ ...manualTransaction, category: itemValue })
                        }>
                        <Picker.Item label="Select Category" value="" />
                        <Picker.Item label="Fuel" value="fuel" />
                        {/* Add your category options here */}
                    </Picker>
                    <TextInput
                        style={styles.input}
                        placeholder="Title"
                        value={manualTransaction.title}
                        onChangeText={(text) => setManualTransaction({ ...manualTransaction, title: text })}
                    />
                    <TextInput
                        style={styles.input}
                        placeholder="Amount"
                        value={manualTransaction.amountin}
                        onChangeText={(text) => setManualTransaction({ ...manualTransaction, amountin: text })}
                    />
                    <Button title="Select Date" onPress={() => {/* Implement date picker */}} />
                    <Button title="Submit" onPress={handleManualTransactionSubmit} />
                    <Button title="Cancel" onPress={() => setShowManualInput(false)} />
                </View>
            </Modal>
                {/* <Button title="Refresh" onPress={refreshTransactions} /> */}
                {/* <Button title="Filter by Date" onPress={handleDateFilter} /> */}
                <Button title="Open" onPress={() => setOpen(true)} />
                <DatePicker
                    modal
                    mode='date'
                    open={open}
                    date={moment(selectedDate, 'YYYY-MM-DD').toDate()}
                    onConfirm={(date) => {
                        setOpen(false)
                        setSelectedDate(date)
                        console.log(selectedDate, "jk");
                    }}
                    onCancel={() => {
                        setOpen(false)
                    }}
                />
            </View>
            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#0000ff" />
                    <Text>Loading</Text>
                </View>
            ) : (
                // <View>
                //     {
                //         filteredTransactions !== 0 ? (
                //             <FlatList
                //                 data={filteredTransactions}
                //                 renderItem={renderTransaction}
                //                 keyExtractor={(item) => item.date}
                //             />
                //         ) : <FlatList
                //             data={transactions}
                //             renderItem={renderTransaction}
                //             keyExtractor={(item) => item.date}
                //         />
                //     }
                // </View>
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
    },
    bankLogo:{
        width: 50,
        height: 50
    },
    modalContainer: {
        backgroundColor: '#fff',
        padding: 20,
        borderRadius: 10
    }
});

export default SMSTracker;
