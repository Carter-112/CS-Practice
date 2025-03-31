document.addEventListener('DOMContentLoaded', () => {
    // --- Configuration ---
    const SET_CONFIG = {
        'ca4': {
            dataUrl: 'flashcards_ca4.json',
            cacheKey: 'flashcardProgress_ca4_v1',
            name: 'CA4 (MIPS)'
        },
        'ca5': {
            dataUrl: 'flashcards_ca5.json',
            cacheKey: 'flashcardProgress_ca5_v1',
            name: 'CA5 (Performance)'
        }
    };
    const DEFAULT_SET_ID = 'ca4';
    const DEFAULT_WEIGHT = 1.0;
    const WEIGHTS = {
        understand: 0.5,
        'little-bit': 1.5,
        'no-idea': 3.0,
    };

    // --- State ---
    let flashcards = [];
    let currentCardIndex = 0;
    let currentSetId = DEFAULT_SET_ID;
    let answerRevealed = false;

    // --- DOM Elements Cache ---
    const loadingIndicator = document.getElementById('loadingIndicator');
    const appContent = document.getElementById('appContent');
    const setSelector = document.getElementById('setSelector');
    const cardSelector = document.getElementById('cardSelector');
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
    const resetProgressBtn = document.getElementById('resetProgressBtn'); // <-- Add reset button

    // --- Initialization ---
    async function init() {
        setupEventListeners();
        await loadSet(DEFAULT_SET_ID);
    }

    // --- Load a Specific Card Set ---
    async function loadSet(setId) {
        console.log(`Loading set: ${setId}`);
        showLoading(true);
        appContent.style.display = 'none';
        currentSetId = setId;

        const config = SET_CONFIG[setId];
        if (!config) {
            showError(`Configuration for set "${setId}" not found.`);
            showLoading(false);
            return;
        }

        try {
            const rawData = await fetchData(config.dataUrl);
            const savedProgress = loadProgress(config.cacheKey);
            flashcards = processData(rawData, savedProgress);

            if (flashcards.length === 0) {
                showError(`No flashcards loaded for ${config.name}. Check the data file.`);
                 showLoading(false);
                 // Ensure UI reflects empty state even on load error after processing
                 populateCardSelector();
                 updateStats();
                return;
            }

            populateCardSelector();
            displayCard(0);
            updateStats();
            showLoading(false);
            appContent.style.display = 'block';

        } catch (error) {
            console.error(`Failed to load set ${setId}:`, error);
            showError(`Error loading ${config.name}: ${error.message}`);
            showLoading(false);
            flashcards = [];
            populateCardSelector();
            updateStats();
        }
    }

    // --- Data Handling ---
    // fetchData and processData remain the same as before
    async function fetchData(url) {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status} for ${url}`);
        }
        try {
            return await response.json();
        } catch (jsonError) {
             throw new Error(`Invalid JSON received from ${url}: ${jsonError.message}`);
        }
    }

    function processData(rawData, savedProgress) {
        if (!Array.isArray(rawData)) {
            console.error("Fetched data is not an array:", rawData);
            throw new Error("Invalid data format received.");
        }
        return rawData.map(card => {
             if (card.id === undefined || card.id === null) {
                 console.warn("Card missing ID:", card);
                 return null;
             }
            const progress = savedProgress[card.id] || {};
            return {
                ...card,
                weight: progress.weight !== undefined ? progress.weight : DEFAULT_WEIGHT,
                category: progress.category || null,
            };
        }).filter(card => card !== null);
    }


    // --- Caching (localStorage) ---
    // loadProgress and saveProgress remain the same as before
    function loadProgress(cacheKey) {
        try {
            const saved = localStorage.getItem(cacheKey);
            return saved ? JSON.parse(saved) : {};
        } catch (error) {
            console.error(`Error loading progress from localStorage (key: ${cacheKey}):`, error);
            return {};
        }
    }

    function saveProgress() {
        const cacheKey = SET_CONFIG[currentSetId]?.cacheKey;
        if (!cacheKey) {
            console.error("Cannot save progress: Unknown cache key for current set.");
            return;
        }
        try {
            const progressToSave = {};
            flashcards.forEach(card => {
                if (card && (card.weight !== DEFAULT_WEIGHT || card.category !== null)) {
                    if (card.id !== undefined && card.id !== null) {
                        progressToSave[card.id] = {
                            weight: card.weight,
                            category: card.category
                        };
                    } else {
                        console.warn("Attempted to save progress for card without ID:", card);
                    }
                }
            });
            if (Object.keys(progressToSave).length > 0) {
                 localStorage.setItem(cacheKey, JSON.stringify(progressToSave));
            } else {
                 localStorage.removeItem(cacheKey);
            }
        } catch (error) {
            console.error(`Error saving progress to localStorage (key: ${cacheKey}):`, error);
        }
    }


    // --- UI Updates ---
    // showLoading, showError, populateCardSelector, displayCard, updateStats remain the same as before
      function showLoading(isLoading) {
        loadingIndicator.textContent = 'Loading cards...'; // Reset message
        loadingIndicator.style.color = ''; // Reset color
        loadingIndicator.style.display = isLoading ? 'block' : 'none';
        // appContent visibility handled in loadSet now
    }

    function showError(message) {
        loadingIndicator.textContent = message;
        loadingIndicator.style.color = 'red';
        loadingIndicator.style.display = 'block';
        appContent.style.display = 'none';
    }


    function populateCardSelector() {
        cardSelector.innerHTML = ''; // Clear existing options
        if (flashcards.length > 0) {
            flashcards.forEach((card, index) => {
                 // Ensure card object is valid before creating option
                 if (card && card.id !== undefined) {
                     const option = document.createElement('option');
                     option.value = index;
                     option.textContent = `Card ${card.id}`;
                     cardSelector.appendChild(option);
                 } else {
                     console.warn("Skipping invalid card during selector population:", card);
                 }
            });
            cardSelector.disabled = false;
            randomCardBtn.disabled = false;

        } else {
             const option = document.createElement('option');
             option.textContent = "No cards available";
             option.disabled = true;
             cardSelector.appendChild(option);
             cardSelector.disabled = true;
             randomCardBtn.disabled = true;
        }
    }

    function displayCard(index) {
         if (!flashcards || flashcards.length === 0) {
             questionTextEl.textContent = "No cards loaded for this set.";
             answerTextEl.textContent = "";
             cardNumberEl.textContent = "Card 0 of 0";
             revealBtn.style.display = 'none';
             feedbackControlsEl.style.display = 'none';
             if(resetProgressBtn) resetProgressBtn.disabled = true; // Disable reset if no cards
             return;
         }
          if(resetProgressBtn) resetProgressBtn.disabled = false; // Enable reset if cards exist


        if (index < 0 || index >= flashcards.length) {
            console.warn(`Invalid card index requested: ${index}. Resetting to 0.`);
            index = 0;
             if (flashcards.length === 0) return;
        }

        currentCardIndex = index;
        const card = flashcards[currentCardIndex];

         if (!card) {
             console.error(`Card at index ${index} is undefined.`);
             questionTextEl.textContent = "Error displaying card.";
             answerTextEl.textContent = "";
             return;
         }


        cardNumberEl.textContent = `Card ${card.id} of ${flashcards.length}`;
        questionTextEl.textContent = card.question || "[No Question]";
        answerTextEl.textContent = card.answer || "[No Answer]";

        answerTextEl.classList.remove('visible');
        answerTextEl.style.display = 'none';
        revealBtn.style.display = 'block';
        feedbackControlsEl.classList.remove('visible');
        feedbackControlsEl.style.display = 'none';
        answerRevealed = false;

        cardSelector.value = index;
    }

    function updateStats() {
        if (!flashcards || flashcards.length === 0) {
             statsDisplayEl.textContent = "No statistics available.";
             return;
        }
        const total = flashcards.length;
        const understood = flashcards.filter(card => card?.category === 'understand').length;
        const littleBit = flashcards.filter(card => card?.category === 'little-bit').length;
        const noIdea = flashcards.filter(card => card?.category === 'no-idea').length;
        const unrated = total - understood - littleBit - noIdea;

        statsDisplayEl.innerHTML = `
            Progress (${SET_CONFIG[currentSetId]?.name || 'Current Set'}):
            <span style="color: var(--primary-color);">${understood} understood</span> |
            <span style="color: var(--warning-color);">${littleBit} need review</span> |
            <span style="color: var(--danger-color);">${noIdea} not known</span> |
            <span style="color: var(--medium-text);">${unrated} unrated</span>
            (${total} total)
        `;
    }

    // --- Event Handling ---
    function setupEventListeners() {
        setSelector.addEventListener('change', (event) => {
             const selectedSetId = event.target.value;
             loadSet(selectedSetId);
        });

        randomCardBtn.addEventListener('click', selectWeightedRandomCard);
        revealBtn.addEventListener('click', handleReveal);
        understandBtn.addEventListener('click', () => handleFeedback('understand'));
        littleBitBtn.addEventListener('click', () => handleFeedback('little-bit'));
        noIdeaBtn.addEventListener('click', () => handleFeedback('no-idea'));
        cardSelector.addEventListener('change', handleGoToCard);
        resetProgressBtn.addEventListener('click', handleResetProgress); // <-- Add listener for reset
    }

    // handleGoToCard, handleReveal, handleFeedback remain the same as before
     function handleGoToCard() {
        const selectedIndex = parseInt(cardSelector.value, 10);
        if (!isNaN(selectedIndex) && selectedIndex >= 0 && selectedIndex < flashcards.length) {
            displayCard(selectedIndex);
        } else if (!isNaN(selectedIndex)) {
             console.warn(`Attempted to navigate to invalid index: ${selectedIndex}`);
             cardSelector.value = currentCardIndex;
        }
    }


     function handleReveal() {
         if (!flashcards || flashcards.length === 0) return;

        answerTextEl.style.display = 'block';
        setTimeout(() => {
            answerTextEl.classList.add('visible');
        }, 10);

        revealBtn.style.display = 'none';
        feedbackControlsEl.style.display = 'flex';
        setTimeout(() => {
            feedbackControlsEl.classList.add('visible');
        }, 10);

        answerRevealed = true;
    }

    function handleFeedback(category) {
        if (!answerRevealed || !flashcards || flashcards.length === 0) return;

        if (currentCardIndex < 0 || currentCardIndex >= flashcards.length) {
             console.error("Invalid currentCardIndex during feedback:", currentCardIndex);
             return;
        }
        const card = flashcards[currentCardIndex];
         if (!card) {
             console.error(`Card at index ${currentCardIndex} is undefined during feedback.`);
             return;
         }

        card.category = category;
        card.weight = WEIGHTS[category] || DEFAULT_WEIGHT;

        saveProgress();
        updateStats();

         if (flashcards.length > 1) {
            selectWeightedRandomCard();
        } else if (flashcards.length === 1) {
            displayCard(currentCardIndex);
        }
    }

    // --- Reset Progress Function --- <--- NEW FUNCTION
    function handleResetProgress() {
        if (!flashcards || flashcards.length === 0) {
            alert("No progress to reset for an empty set.");
            return;
        }

        // Confirm with the user
        if (!confirm(`Are you sure you want to reset all progress for the "${SET_CONFIG[currentSetId]?.name || 'current'}" set? This cannot be undone.`)) {
            return; // User cancelled
        }

        // Get the cache key for the current set
        const cacheKey = SET_CONFIG[currentSetId]?.cacheKey;
        if (!cacheKey) {
            console.error("Cannot reset progress: Unknown cache key for current set.");
            alert("Error: Could not determine which progress set to reset.");
            return;
        }

        // Remove the specific set's progress from localStorage
        try {
            localStorage.removeItem(cacheKey);
            console.log(`Progress cache cleared for ${currentSetId} (key: ${cacheKey})`);
        } catch (error) {
             console.error(`Error removing item from localStorage (key: ${cacheKey}):`, error);
             alert("An error occurred while trying to clear saved progress.");
             // Continue to reset in-memory data anyway
        }


        // Reset the weight and category for all cards currently in memory
        flashcards.forEach(card => {
            if (card) { // Ensure card exists
                card.weight = DEFAULT_WEIGHT;
                card.category = null;
            }
        });

        // Update the UI
        updateStats();
        // Redisplay the current card to clear feedback buttons etc.
        displayCard(currentCardIndex);

        alert(`Progress for the "${SET_CONFIG[currentSetId]?.name || 'current'}" set has been reset.`);
    }


    // --- Card Selection Logic ---
    // selectWeightedRandomCard remains the same as before
     function selectWeightedRandomCard() {
        if (!flashcards || flashcards.length === 0) {
             console.log("No cards available for random selection.");
             displayCard(-1); // Show empty state
             return;
        }
        if (flashcards.length === 1) {
            displayCard(0);
            return;
        }

        flashcards.forEach(card => {
            if (!card) return;
            if (typeof card.weight !== 'number' || card.weight <= 0 || isNaN(card.weight)) {
                 card.weight = DEFAULT_WEIGHT;
            }
        });

        const availableCards = flashcards.filter(card => card && typeof card.weight === 'number' && card.weight > 0);

        if (availableCards.length === 0) {
             console.warn("No cards with positive weight available, selecting completely randomly.");
             displayCard(Math.floor(Math.random() * flashcards.length));
             return;
        }

         let possibleIndices = availableCards.map((_, i) => i);
         let currentCardInAvailableIndex = availableCards.findIndex((card, idx) => flashcards.indexOf(card) === currentCardIndex);

         let adjustedTotalWeight = availableCards.reduce((sum, card) => sum + card.weight, 0);
         let randomValue = Math.random() * adjustedTotalWeight;
         let cumulativeWeight = 0;
         let nextAvailableIndex = -1;

         for (let i = 0; i < availableCards.length; i++) {
            cumulativeWeight += availableCards[i].weight;
            if (randomValue <= cumulativeWeight) {
                if (i === currentCardInAvailableIndex && availableCards.length > 1) {
                    continue;
                }
                nextAvailableIndex = i;
                break;
            }
        }
        if (nextAvailableIndex === -1) {
             if (availableCards.length > 0) {
                nextAvailableIndex = Math.floor(Math.random() * availableCards.length);
                // Avoid picking current card if possible on random fallback
                if(availableCards.length > 1 && nextAvailableIndex === currentCardInAvailableIndex) {
                    nextAvailableIndex = (nextAvailableIndex + 1) % availableCards.length;
                }
             } else {
                  console.error("Fallback failed: No available cards.");
                  return;
             }
         }

        const nextOriginalIndex = flashcards.indexOf(availableCards[nextAvailableIndex]);

        if (nextOriginalIndex === -1) {
             console.error("Failed to find original index for selected card.");
             displayCard(Math.floor(Math.random() * flashcards.length));
        } else {
            displayCard(nextOriginalIndex);
        }
    }

    // --- Start the App ---
    init();

}); // End DOMContentLoaded listener