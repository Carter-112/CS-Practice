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
    const goToCardBtn = document.getElementById('goToCardBtn');
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
            displayCard(0); // Display first card initially
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
        goToCardBtn.disabled = flashcards.length <= 1;
    }

    function displayCard(index) {
        if (index < 0 || index >= flashcards.length) {
            console.warn(`Invalid card index requested: ${index}`);
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
        goToCardBtn.addEventListener('click', handleGoToCard);
        randomCardBtn.addEventListener('click', selectWeightedRandomCard);
        revealBtn.addEventListener('click', handleReveal);
        understandBtn.addEventListener('click', () => handleFeedback('understand'));
        littleBitBtn.addEventListener('click', () => handleFeedback('little-bit'));
        noIdeaBtn.addEventListener('click', () => handleFeedback('no-idea'));
         // Add listener for dropdown change as well
        cardSelector.addEventListener('change', handleGoToCard);
    }

    function handleGoToCard() {
        const selectedIndex = parseInt(cardSelector.value, 10);
        if (!isNaN(selectedIndex)) {
            displayCard(selectedIndex);
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

        const totalWeight = flashcards.reduce((sum, card) => sum + card.weight, 0);

        if (totalWeight <= 0) {
            // Fallback if all weights somehow became zero or negative
            console.warn("Total weight is zero or less, selecting randomly.");
            displayCard(Math.floor(Math.random() * flashcards.length));
            return;
        }

        let randomValue = Math.random() * totalWeight;
        let cumulativeWeight = 0;
        let nextIndex = -1;

        for (let i = 0; i < flashcards.length; i++) {
            cumulativeWeight += flashcards[i].weight;
            if (randomValue <= cumulativeWeight) {
                 // Don't pick the same card twice in a row if possible
                 if (i === currentCardIndex && flashcards.length > 1) {
                     // Try to find the *next* card in the weighted list instead
                     // This is a simple heuristic, not perfectly avoiding repeats
                     continue;
                 }
                nextIndex = i;
                break;
            }
        }
         // If the loop finished because the only valid card was the current one,
         // or if something went wrong, just pick the last card considered
        if (nextIndex === -1) {
             nextIndex = flashcards.length - 1; // Fallback
             // Or could pick a truly random non-current card as another fallback
             // let possibleIndices = flashcards.map((_, idx) => idx).filter(idx => idx !== currentCardIndex);
             // nextIndex = possibleIndices[Math.floor(Math.random() * possibleIndices.length)];
        }


        displayCard(nextIndex);
    }

    // --- Start the App ---
    init();

}); // End DOMContentLoaded listener