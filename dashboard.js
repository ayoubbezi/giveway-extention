document.addEventListener('DOMContentLoaded', () => {
    console.log('Dashboard script loaded.');

    try {
        // Initialize Firebase
        firebase.initializeApp(firebaseConfig);
        const db = firebase.firestore();
        console.log('Firebase initialized.');

        const tradeLinkList = document.getElementById('tradeLinkList');
        const container = document.getElementById('tradeLinkListContainer');

        const loadTradeLinks = async () => {
            container.innerHTML = '<p>Loading user data...</p>';
            try {
                const usersSnapshot = await db.collection('users').orderBy('createdAt', 'desc').get();

                if (usersSnapshot.empty) {
                    container.innerHTML = '<p>No users found in the database yet.</p>';
                    return;
                }

                tradeLinkList.innerHTML = ''; // Clear list
                usersSnapshot.forEach(doc => {
                    const user = doc.data();
                    const li = document.createElement('li');
                    const tradeLink = user.tradeLink || 'Not set';
                    const userXP = user.xp || 0;
                    li.innerHTML = `<strong>XP:</strong> ${userXP} | <strong>Link:</strong> ${tradeLink}`;
                    tradeLinkList.appendChild(li);
                });
                container.prepend(tradeLinkList);

            } catch (error) {
                console.error("Error loading trade links: ", error);
                container.innerHTML = `<p>Error loading data: ${error.message}</p>`;
            }
        };

        loadTradeLinks();

    } catch (error) {
        console.error('Failed to initialize Firebase on dashboard:', error);
        document.getElementById('tradeLinkListContainer').innerHTML = '<p>Error initializing Firebase. Check console.</p>';
    }
});
