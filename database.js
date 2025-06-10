// This script centralizes all IndexedDB operations.

let db = null;

// This promise will resolve with the database instance once it's ready.
const dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open('cs2GiveawayDB', 1);

    request.onupgradeneeded = (event) => {
        const dbInstance = event.target.result;
        if (!dbInstance.objectStoreNames.contains('xp')) {
            dbInstance.createObjectStore('xp', { keyPath: 'action' });
        }
    };

    request.onsuccess = (event) => {
        db = event.target.result;
        console.log('Database initialized successfully.');
        resolve(db);
    };

    request.onerror = (event) => {
        console.error('Database error:', event.target.errorCode);
        reject(event.target.errorCode);
    };
});

// Export a function that returns the promise. This ensures that other scripts
// can wait for the database to be ready before proceeding.
// Export a function that returns the promise by attaching it to the global scope.
self.getDb = () => dbPromise;
