document.addEventListener('DOMContentLoaded', () => {
    // --- Configuration ---
    const DATA_URL = 'flashcards.json';
    const CACHE_KEY = 'flashcardProgress_v1'; // Key for localStorage
    const DEFAULT_WEIGHT = 1.0;
    const WEIGHTS = {
        understand: 0.5,
        'little-bit': 1.5,
        'no-idea': 3.0,
    };

    // --- State ---
    let flashcards = [];
    let currentCardIndex = 0;
    let answerRevealed = false;

    // --- DOM Elements Cache ---
    const loadingIndicator = document.getElementById('loadingIndicator');
    const appContent = document.getElementById('appContent');
    const cardSelector = document.getElementById('cardSelector');
    // Go button element removed
    const randomCardBtn = document.getElementById('randomCardBtn');
    const cardNumberEl = document.getElementById('cardNumber');
    const questionTextEl = document.getElementById('questionText');
    const answerTextEl = document.getElementById('answerText');
    const revealBtn = document.getElementById('revealBtn');
    const feedbackControlsEl = document.getElementById('feedbackControls');
    const understandBtn = document.getElementById('understandBtn');
    const littleBitBtn = document.getElementById('littleBitBtn');
    const noIdeaBtn = document.getElementById('noIdeaBtn');
    const statsDisplayEl = document.getElementById('statsDisplay');

    // --- Initialization ---
    async function init() {
        try {
            showLoading(true);
            const rawData = await fetchData(DATA_URL);
            const savedProgress = loadProgress();
            flashcards = processData(rawData, savedProgress);

            if (flashcards.length === 0) {
                showError("No flashcards loaded. Check the data file.");
                return;
            }

            populateCardSelector();
            setupEventListeners();
            // Display first card initially, or last viewed if that state was saved (advanced)
            // For simplicity, we always start at 0 but apply saved weights/categories
            displayCard(0);
            updateStats();
            showLoading(false);

        } catch (error) {
            console.error("Initialization failed:", error);
            showError(`Error loading flashcards: ${error.message}`);
            showLoading(false);
        }
    }

    // --- Data Handling ---
    async function fetchData(url) {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json();
    }

    function processData(rawData, savedProgress) {
         // Ensure rawData is an array
        if (!Array.isArray(rawData)) {
            console.error("Fetched data is not an array:", rawData);
            throw new Error("Invalid data format received.");
        }
        return rawData.map(card => {
            const progress = savedProgress[card.id] || {};
            return {
                ...card, // Spread existing card data (id, question, answer)
                weight: progress.weight !== undefined ? progress.weight : DEFAULT_WEIGHT,
                category: progress.category || null, // null means unrated
            };
        });
    }

    // --- Caching (localStorage) ---
    function loadProgress() {
        try {
            const saved = localStorage.getItem(CACHE_KEY);
            return saved ? JSON.parse(saved) : {};
        } catch (error) {
            console.error("Error loading progress from localStorage:", error);
            return {}; // Return empty object on error
        }
    }

    function saveProgress() {
        try {
            const progressToSave = {};
            flashcards.forEach(card => {
                // Only save if weight or category is not default/null
                if (card.weight !== DEFAULT_WEIGHT || card.category !== null) {
                    progressToSave[card.id] = {
                        weight: card.weight,
                        category: card.category
                    };
                }
            });
            if (Object.keys(progressToSave).length > 0) {
                 localStorage.setItem(CACHE_KEY, JSON.stringify(progressToSave));
            } else {
                 localStorage.removeItem(CACHE_KEY); // Clean up if no progress
            }
        } catch (error) {
            console.error("Error saving progress to localStorage:", error);
        }
    }


    // --- UI Updates ---
    function showLoading(isLoading) {
        loadingIndicator.style.display = isLoading ? 'block' : 'none';
        appContent.style.display = isLoading ? 'none' : 'block';
    }

    function showError(message) {
        loadingIndicator.textContent = message;
        loadingIndicator.style.color = 'red';
        loadingIndicator.style.display = 'block';
        appContent.style.display = 'none';
    }


    function populateCardSelector() {
        cardSelector.innerHTML = ''; // Clear existing options
        flashcards.forEach((card, index) => {
            const option = document.createElement('option');
            option.value = index; // Use index for direct access
            option.textContent = `Card ${card.id}`;
            cardSelector.appendChild(option);
        });
        // Disable dropdown if only one card
        cardSelector.disabled = flashcards.length <= 1;
        // Disabling logic for Go button removed
    }

    function displayCard(index) {
        if (index < 0 || index >= flashcards.length) {
            console.warn(`Invalid card index requested: ${index}`);
            // Attempt to recover or show an error? For now, just return.
            return;
        }
        currentCardIndex = index;
        const card = flashcards[currentCardIndex];

        cardNumberEl.textContent = `Card ${card.id} of ${flashcards.length}`;
        questionTextEl.textContent = card.question;
        answerTextEl.textContent = card.answer;

        // Reset view
        answerTextEl.classList.remove('visible');
        answerTextEl.style.display = 'none'; // Hide fully first
        revealBtn.style.display = 'block';
        feedbackControlsEl.classList.remove('visible');
        feedbackControlsEl.style.display = 'none'; // Hide fully first
        answerRevealed = false;

        // Update dropdown selector to match current card
        cardSelector.value = index;
    }

    function updateStats() {
        if (!flashcards || flashcards.length === 0) {
             statsDisplayEl.textContent = "No cards loaded.";
             return;
        }
        const total = flashcards.length;
        const understood = flashcards.filter(card => card.category === 'understand').length;
        const littleBit = flashcards.filter(card => card.category === 'little-bit').length;
        const noIdea = flashcards.filter(card => card.category === 'no-idea').length;
        const unrated = total - understood - littleBit - noIdea;

        statsDisplayEl.innerHTML = `
            Progress:
            <span style="color: var(--primary-color);">${understood} understood</span> |
            <span style="color: var(--warning-color);">${littleBit} need review</span> |
            <span style="color: var(--danger-color);">${noIdea} not known</span> |
            <span style="color: var(--medium-text);">${unrated} unrated</span>
            (${total} total)
        `;
    }

    // --- Event Handling ---
    function setupEventListeners() {
        // Event listener for Go button removed
        randomCardBtn.addEventListener('click', selectWeightedRandomCard);
        revealBtn.addEventListener('click', handleReveal);
        understandBtn.addEventListener('click', () => handleFeedback('understand'));
        littleBitBtn.addEventListener('click', () => handleFeedback('little-bit'));
        noIdeaBtn.addEventListener('click', () => handleFeedback('no-idea'));
         // Keep listener for dropdown change
        cardSelector.addEventListener('change', handleGoToCard); // Navigates on selection change
    }

    // This function is now only triggered by the cardSelector 'change' event
    function handleGoToCard() {
        const selectedIndex = parseInt(cardSelector.value, 10);
        // Check if selectedIndex is a valid number and within bounds
        if (!isNaN(selectedIndex) && selectedIndex >= 0 && selectedIndex < flashcards.length) {
            displayCard(selectedIndex);
        } else if (!isNaN(selectedIndex)) {
             console.warn(`Attempted to navigate to invalid index: ${selectedIndex}`);
             // Optionally reset selector to current card if navigation fails
             cardSelector.value = currentCardIndex;
        }
    }


     function handleReveal() {
        answerTextEl.style.display = 'block'; // Make it block first
        // Use timeout to allow display:block to apply before adding class for transition
        setTimeout(() => {
            answerTextEl.classList.add('visible');
        }, 10); // Small delay

        revealBtn.style.display = 'none';
        feedbackControlsEl.style.display = 'flex'; // Make it flex first
        setTimeout(() => {
            feedbackControlsEl.classList.add('visible');
        }, 10);

        answerRevealed = true;
    }

    function handleFeedback(category) {
        if (!answerRevealed) return; // Prevent rating before revealing

        const card = flashcards[currentCardIndex];
        card.category = category;
        card.weight = WEIGHTS[category] || DEFAULT_WEIGHT;

        saveProgress(); // Save updated progress to localStorage
        updateStats();

        // Optionally, move to the next card automatically after rating
         if (flashcards.length > 1) {
            selectWeightedRandomCard();
        } else {
            // If only one card, just reset the view
            displayCard(currentCardIndex);
        }
    }

    // --- Card Selection Logic ---
    function selectWeightedRandomCard() {
        if (flashcards.length === 0) return;
        if (flashcards.length === 1) {
            displayCard(0);
            return;
        }

        // Ensure weights are positive
        flashcards.forEach(card => {
            if (card.weight <= 0) card.weight = 0.01; // Assign a tiny minimum weight
        });

        const totalWeight = flashcards.reduce((sum, card) => sum + (card.weight || DEFAULT_WEIGHT), 0); // Added check for undefined weight


        if (totalWeight <= 0) {
            // Fallback if all weights somehow became zero or negative
            console.warn("Total weight is zero or less, selecting randomly.");
            displayCard(Math.floor(Math.random() * flashcards.length));
            return;
        }

        let randomValue = Math.random() * totalWeight;
        let cumulativeWeight = 0;
        let potentialNextIndex = -1;
        let availableIndices = flashcards.map((_, i) => i); // All indices initially available

        // Try to avoid selecting the current card, especially if many cards exist
        if (flashcards.length > 1) {
            availableIndices = availableIndices.filter(i => i !== currentCardIndex);
            // Recalculate totalWeight excluding the current card if we remove it
            const adjustedTotalWeight = availableIndices.reduce((sum, i) => sum + (flashcards[i].weight || DEFAULT_WEIGHT), 0);

            if (adjustedTotalWeight > 0) {
                 randomValue = Math.random() * adjustedTotalWeight; // Reroll based on adjusted weight
                 for (const i of availableIndices) {
                    cumulativeWeight += (flashcards[i].weight || DEFAULT_WEIGHT);
                    if (randomValue <= cumulativeWeight) {
                        potentialNextIndex = i;
                        break;
                    }
                 }
            } else {
                // If removing the current card leaves no weight, pick it (or any random from original list)
                 potentialNextIndex = currentCardIndex; // Or fallback to truly random below
            }

        } else {
             // Only one card, pick it (handled at the start, but defensive)
             potentialNextIndex = 0;
        }


         // If the weighted selection among non-current cards failed, or only 1 card
        if (potentialNextIndex === -1) {
             // Fallback: Just pick any available card randomly if the weighted logic had issues
             if (availableIndices.length > 0) {
                 potentialNextIndex = availableIndices[Math.floor(Math.random() * availableIndices.length)];
             } else {
                 // Absolute fallback: pick the first card if all else fails
                 potentialNextIndex = 0;
             }
        }

        displayCard(potentialNextIndex);
    }

    // --- Start the App ---
    init();

}); // End DOMContentLoaded listener