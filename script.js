document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const welcomeScreen = document.getElementById('welcomeScreen');
    const firstNameInput = document.getElementById('firstNameInput');
    const startButton = document.getElementById('startButton');

    const scenarioSelectionScreen = document.getElementById('scenarioSelectionScreen');
    const scenarioWelcomeTitle = document.getElementById('scenarioWelcomeTitle');
    const scenarioGrid = document.getElementById('scenarioGrid');

    const mainSimulatorScreen = document.getElementById('mainSimulatorScreen'); // Changed from .container
    const rtNamePlaceholder = document.getElementById('rtNamePlaceholder');

    const ipapInput = document.getElementById('ipap');
    const epapInput = document.getElementById('epap');
    const fio2Input = document.getElementById('fio2');
    const submitBtn = document.getElementById('submitBtn');

    const phResult = document.getElementById('phResult');
    const paco2Result = document.getElementById('paco2Result');
    const pao2Result = document.getElementById('pao2Result');
    const hco3Result = document.getElementById('hco3Result');
    const vtResult = document.getElementById('vtResult');

    const scenarioText = document.getElementById('scenarioText');
    const initialPH = document.getElementById('initialPH');
    const initialPaCO2 = document.getElementById('initialPaCO2');
    const initialPaO2 = document.getElementById('initialPaO2');
    const initialHCO3 = document.getElementById('initialHCO3');

    // Feedback Popup Elements
    const feedbackPopup = document.getElementById('feedbackPopup');
    const feedbackTitle = document.getElementById('feedbackTitle');
    const feedbackMessage = document.getElementById('feedbackMessage');
    const initialIpapFb = document.getElementById('initialIpapFb');
    const initialEpapFb = document.getElementById('initialEpapFb');
    const initialFio2Fb = document.getElementById('initialFio2Fb');
    const finalIpapFb = document.getElementById('finalIpapFb');
    const finalEpapFb = document.getElementById('finalEpapFb');
    const finalFio2Fb = document.getElementById('finalFio2Fb');
    const impactList = document.getElementById('impactList');
    const nextScenarioBtn = document.getElementById('nextScenarioBtn');
    const repeatScenarioBtn = document.getElementById('repeatScenarioBtn');
    const backToSelectionBtn = document.getElementById('backToSelectionBtn');

    // New button from main simulator screen
    const backToScenarioSelectionFromSimBtn = document.getElementById('backToScenarioSelectionFromSimBtn');


    // --- Global Variables ---
    let userName = '';
    let currentScenario = null; // Stores the current scenario object
    let currentScenarioIndex = -1; // Index of the current scenario
    let initialBIPAPSettingsForScenario = {}; // Stores the BIPAP settings the scenario started with
    let finalBIPAPSettingsApplied = {}; // Stores the BIPAP settings the user applied to fix ABG

    // --- Target ABG Ranges for "Fixed" State ---
    const TARGET_PH_MIN = 7.35;
    const TARGET_PH_MAX = 7.45;
    const TARGET_PACO2_MIN = 35;
    const TARGET_PACO2_MAX = 45;
    const TARGET_PAO2_MIN = 80;
    const TARGET_PAO2_MAX = 100;

    // --- ABG and Vt Simulation Logic ---
    function simulateABG(currentIpap, currentEpap, currentFiO2, scenarioInitialABG, scenarioInitialBIPAP) {
        let ph = parseFloat(scenarioInitialABG.pH);
        let paco2 = parseFloat(scenarioInitialABG.paco2);
        let pao2 = parseFloat(scenarioInitialABG.pao2);
        let hco3 = parseFloat(scenarioInitialABG.hco3);

        const currentPs = currentIpap - currentEpap;
        const initialPsScenario = scenarioInitialBIPAP.ipap - scenarioInitialBIPAP.epap;

        // --- Simulate Tidal Volume (Vt) ---
        const BASE_VT = 300;
        const VT_PER_PS = 50;
        let simulatedVt = BASE_VT + (currentPs * VT_PER_PS);
        simulatedVt = Math.round(Math.max(150, Math.min(1200, simulatedVt)));

        // --- Impact of PS on CO2 (ventilation) - MUCH More Drastic Effect ---
        const paco2ChangeFactor = 5;
        let paco2Change = (initialPsScenario - currentPs) * paco2ChangeFactor;
        paco2 = scenarioInitialABG.paco2 + paco2Change;
        paco2 = Math.max(20, Math.min(90, paco2));

        // --- Impact of FIO2 and EPAP on O2 - MUCH More Drastic Effect ---
        let pao2ChangeFromFiO2 = (currentFiO2 - scenarioInitialBIPAP.fio2) * 5;
        let pao2ChangeFromEpap = (currentEpap - scenarioInitialBIPAP.epap) * 3;

        pao2 = scenarioInitialABG.pao2 + pao2ChangeFromFiO2 + pao2ChangeFromEpap;
        pao2 = Math.max(30, Math.min(600, pao2));

        // --- pH and HCO3 based on Henderson-Hasselbalch ---
        if (hco3 <= 0) hco3 = 1;
        if (paco2 <= 0) paco2 = 0.01;
        ph = 6.1 + Math.log10(hco3 / (0.03 * paco2));
        ph = Math.max(6.8, Math.min(7.8, ph));
        hco3 = scenarioInitialABG.hco3; // Keeping HCO3 constant for acute changes

        return {
            pH: ph.toFixed(2),
            PaCO2: Math.round(paco2),
            PaO2: Math.round(pao2),
            HCO3: Math.round(hco3),
            Vt: simulatedVt
        };
    }

    // Function to check if ABG is within "normal" range
    function isABGNormalized(abg) {
        const ph = parseFloat(abg.pH);
        const paco2 = parseFloat(abg.PaCO2);
        const pao2 = parseFloat(abg.PaO2);

        return (
            ph >= TARGET_PH_MIN && ph <= TARGET_PH_MAX &&
            paco2 >= TARGET_PACO2_MIN && paco2 <= TARGET_PACO2_MAX &&
            pao2 >= TARGET_PAO2_MIN && pao2 <= TARGET_PAO2_MAX
        );
    }

    // --- Scenario Definitions (Hospital-Based) ---
    const scenarios = [
        {
            name: "COPD Exacerbation with Acute Respiratory Acidosis",
            shortDescription: "Manage a patient with severe COPD exacerbation and high CO2.",
            initial: { pH: 7.28, paco2: 65, pao2: 55, hco3: 28 },
            initialBIPAP: { ipap: 12, epap: 5, fio2: 40 },
            text: "A 68-year-old male with severe COPD is admitted with acute exacerbation. He's dyspneic, using accessory muscles, and is on BIPAP with the shown settings. His current ABG reflects significant respiratory acidosis and hypoxemia. As RT {name}, your task is to adjust BIPAP settings to improve his ventilation and oxygenation."
        },
        {
            name: "Acute Hypoxemic Respiratory Failure (Pneumonia)",
            shortDescription: "Improve oxygenation in a patient with severe pneumonia.",
            initial: { pH: 7.42, paco2: 38, pao2: 45, hco3: 24 },
            initialBIPAP: { ipap: 15, epap: 8, fio2: 60 },
            text: "A 55-year-old female with severe pneumonia is experiencing acute hypoxemic respiratory failure. Despite high FiO2 and EPAP on BIPAP with the shown settings, she remains significantly hypoxemic. Her ventilation is adequate. As RT {name}, adjust settings to improve oxygenation without causing hyperventilation."
        },
        {
            name: "Hypercapnic Respiratory Failure (CHF Exacerbation)",
            shortDescription: "Correct severe hypercapnia in a heart failure patient.",
            initial: { pH: 7.15, paco2: 80, pao2: 65, hco3: 30 },
            initialBIPAP: { ipap: 18, epap: 6, fio2: 30 },
            text: "A 72-year-old male with acute decompensated heart failure is in severe hypercapnic respiratory failure, currently on BIPAP with the shown settings. He is breathing rapidly but unable to clear CO2 effectively. As RT {name}, improve his ventilation to correct the acidosis and support his breathing."
        },
        {
            name: "Post-Extubation Respiratory Distress",
            shortDescription: "Support breathing and prevent re-intubation after extubation.",
            initial: { pH: 7.32, paco2: 52, pao2: 70, hco3: 26 },
            initialBIPAP: { ipap: 14, epap: 6, fio2: 50 },
            text: "A 45-year-old patient, recently extubated, is showing signs of respiratory distress with mild hypercapnia and hypoxemia, currently on BIPAP with the shown settings. As RT {name}, optimize settings to support his breathing and prevent re-intubation."
        }
    ];

    // --- Core Simulation Functions ---

    function loadScenario(index) {
        currentScenarioIndex = index;
        currentScenario = scenarios[currentScenarioIndex];

        // Personalize scenario text
        let personalizedText = currentScenario.text.replace('{name}', userName);
        scenarioText.textContent = personalizedText;

        initialPH.textContent = currentScenario.initial.pH;
        initialPaCO2.textContent = currentScenario.initial.paco2;
        initialPaO2.textContent = currentScenario.initial.pao2;
        initialHCO3.textContent = currentScenario.initial.hco3;

        // Set the input fields to the scenario's initial BIPAP settings
        ipapInput.value = currentScenario.initialBIPAP.ipap;
        epapInput.value = currentScenario.initialBIPAP.epap;
        fio2Input.value = currentScenario.initialBIPAP.fio2;

        initialBIPAPSettingsForScenario = { ...currentScenario.initialBIPAP }; // Store initial settings for feedback

        // Simulate the initial ABG with the scenario's starting BIPAP settings to display current state
        const initialSimulatedABG = simulateABG(
            currentScenario.initialBIPAP.ipap,
            currentScenario.initialBIPAP.epap,
            currentScenario.initialBIPAP.fio2,
            currentScenario.initial,
            currentScenario.initialBIPAP
        );
        displayResults(initialSimulatedABG);
    }

    function loadNextScenario() {
        let nextIndex = currentScenarioIndex + 1;
        if (nextIndex >= scenarios.length) {
            nextIndex = 0; // Loop back to the first scenario for continuous practice
            alert("You've completed all scenarios! Starting again from the beginning.");
        }
        loadScenario(nextIndex);
        feedbackPopup.style.display = 'none'; // Hide popup
    }

    function repeatCurrentScenario() {
        loadScenario(currentScenarioIndex);
        feedbackPopup.style.display = 'none'; // Hide popup
    }

    function displayResults(abg) {
        phResult.textContent = abg.pH;
        paco2Result.textContent = abg.PaCO2;
        pao2Result.textContent = abg.PaO2;
        hco3Result.textContent = abg.HCO3;
        vtResult.textContent = abg.Vt;
    }

    // --- Feedback Logic ---
    function showFeedback(initialSettings, finalSettings, currentABG, initialABG) {
        feedbackTitle.textContent = `Congratulations, RT ${userName}!`;
        feedbackMessage.textContent = `You successfully managed the patient's ABG.`;

        initialIpapFb.textContent = initialSettings.ipap;
        initialEpapFb.textContent = initialSettings.epap;
        initialFio2Fb.textContent = initialSettings.fio2;

        finalIpapFb.textContent = finalSettings.ipap;
        finalEpapFb.textContent = finalSettings.epap;
        finalFio2Fb.textContent = finalSettings.fio2;

        impactList.innerHTML = ''; // Clear previous impacts

        const initialPs = initialSettings.ipap - initialSettings.epap;
        const finalPs = finalSettings.ipap - finalSettings.epap;

        // Feedback on IPAP changes directly
        if (finalSettings.ipap > initialSettings.ipap) {
            const ipapIncrease = finalSettings.ipap - initialSettings.ipap;
            const psIncrease = finalPs - initialPs;
            const vtIncrease = (psIncrease * 50).toFixed(0);
            const co2Change = (initialABG.paco2 - currentABG.PaCO2).toFixed(1);
            impactList.innerHTML += `<li>You **increased IPAP** by ${ipapIncrease} cmH2O (from ${initialSettings.ipap} to ${finalSettings.ipap}). This increased the pressure support by ${psIncrease} cmH2O, which likely improved ventilation, increased Tidal Volume (Vt) by about ${vtIncrease} mL/breath, and helped reduce PaCO2 by approximately ${Math.abs(co2Change)} mmHg.</li>`;
        } else if (finalSettings.ipap < initialSettings.ipap) {
            const ipapDecrease = initialSettings.ipap - finalSettings.ipap;
            const psDecrease = initialPs - finalPs;
            const vtDecrease = (psDecrease * 50).toFixed(0);
            const co2Change = (currentABG.PaCO2 - initialABG.paco2).toFixed(1);
             impactList.innerHTML += `<li>You **decreased IPAP** by ${ipapDecrease} cmH2O (from ${initialSettings.ipap} to ${finalSettings.ipap}). This reduced pressure support by ${psDecrease} cmH2O, which might decrease ventilation and Tidal Volume (Vt) by about ${vtDecrease} mL/breath. Be mindful as this could increase PaCO2, but in this case, it was beneficial (if PaCO2 was too low).</li>`;
        } else {
            impactList.innerHTML += `<li>Your **IPAP** setting remained consistent.</li>`;
        }

        // Feedback on EPAP changes
        if (finalSettings.epap > initialSettings.epap) {
            const epapIncrease = finalSettings.epap - initialSettings.epap;
            impactList.innerHTML += `<li>You **increased EPAP** by ${epapIncrease} cmH2O (from ${initialSettings.epap} to ${finalSettings.epap}). Higher EPAP acts like PEEP, which can help recruit collapsed alveoli and improve oxygenation.</li>`;
        } else if (finalSettings.epap < initialSettings.epap) {
            const epapDecrease = initialSettings.epap - finalSettings.epap;
            impactList.innerHTML += `<li>You **decreased EPAP** by ${epapDecrease} cmH2O (from ${initialSettings.epap} to ${finalSettings.epap}). Lower EPAP reduces lung recruitment, which might slightly decrease PaO2.</li>`;
        } else {
            impactList.innerHTML += `<li>Your **EPAP** setting remained consistent.</li>`;
        }

        // Feedback on FiO2 changes
        if (finalSettings.fio2 > initialSettings.fio2) {
            const fio2Increase = finalSettings.fio2 - initialSettings.fio2;
            const pao2Change = (currentABG.PaO2 - initialABG.pao2).toFixed(1);
            impactList.innerHTML += `<li>You **increased FiO2** by ${fio2Increase}% (from ${initialSettings.fio2}% to ${finalSettings.fio2}%). This directly improved oxygen uptake, increasing PaO2 by approximately ${pao2Change} mmHg.</li>`;
        } else if (finalSettings.fio2 < initialSettings.fio2) {
            const fio2Decrease = initialSettings.fio2 - finalSettings.fio2;
            const pao2Change = (initialABG.pao2 - currentABG.PaO2).toFixed(1);
            impactList.innerHTML += `<li>You **decreased FiO2** by ${fio2Decrease}% (from ${initialSettings.fio2}% to ${finalSettings.fio2}%). This reduced the delivered oxygen, potentially decreasing PaO2 by approximately ${pao2Change} mmHg.</li>`;
        } else {
            impactList.innerHTML += `<li>Your **FiO2** setting remained consistent.</li>`;
        }

        feedbackPopup.style.display = 'flex'; // Show the popup
    }

    // --- Scenario Selection Page Logic ---
    function generateScenarioCards() {
        scenarioGrid.innerHTML = ''; // Clear existing cards
        scenarios.forEach((scenario, index) => {
            const card = document.createElement('div');
            card.classList.add('scenario-card');
            card.dataset.index = index; // Store index for later use

            const title = document.createElement('h3');
            title.textContent = scenario.name;
            card.appendChild(title);

            const description = document.createElement('p');
            description.textContent = scenario.shortDescription;
            card.appendChild(description);

            card.addEventListener('click', () => {
                loadScenario(index); // Load the selected scenario
                scenarioSelectionScreen.style.display = 'none'; // Hide selection screen
                mainSimulatorScreen.style.display = 'flex'; // Show main simulator
            });
            scenarioGrid.appendChild(card);
        });
    }

    function showScenarioSelection() {
        mainSimulatorScreen.style.display = 'none';
        feedbackPopup.style.display = 'none';
        scenarioSelectionScreen.style.display = 'flex'; // Show the selection screen
        scenarioWelcomeTitle.textContent = `Welcome, RT ${userName}!`;
        generateScenarioCards(); // Re-generate cards in case they need refreshing
    }


    // --- Event Listeners ---

    // Welcome Screen Logic
    startButton.addEventListener('click', () => {
        const name = firstNameInput.value.trim();
        if (name) {
            userName = name;
            rtNamePlaceholder.textContent = userName; // Set RT name in scenario panel
            welcomeScreen.style.display = 'none'; // Hide welcome screen
            showScenarioSelection(); // Transition to scenario selection
        } else {
            alert('Please enter your first name to begin!');
        }
    });

    submitBtn.addEventListener('click', () => {
        const ipap = parseFloat(ipapInput.value);
        const epap = parseFloat(epapInput.value);
        const fio2 = parseFloat(fio2Input.value);

        // Basic input validation
        if (isNaN(ipap) || isNaN(epap) || isNaN(fio2) || ipap < epap) {
            alert('Please enter valid numbers for IPAP, EPAP, and FiO2. IPAP must be greater than or equal to EPAP.');
            return;
        }
        if (ipap < 4 || ipap > 30) {
            alert('IPAP should be between 4 and 30 cmH2O.');
            return;
        }
        if (epap < 4 || epap > 20) {
            alert('EPAP should be between 4 and 20 cmH2O.');
            return;
        }
        if (fio2 < 21 || fio2 > 100) {
            alert('FiO2 should be between 21% and 100%.');
            return;
        }

        // Simulate based on current input and the *scenario's original initial conditions*
        const simulatedABG = simulateABG(
            ipap, epap, fio2,
            currentScenario.initial, // Initial problem ABG
            currentScenario.initialBIPAP // Initial BIPAP settings for the problem
        );
        displayResults(simulatedABG);

        finalBIPAPSettingsApplied = { ipap, epap, fio2 }; // Store the settings that led to this ABG

        // Check for ABG normalization
        if (isABGNormalized(simulatedABG)) {
            showFeedback(initialBIPAPSettingsForScenario, finalBIPAPSettingsApplied, simulatedABG, currentScenario.initial);
        }
    });

    nextScenarioBtn.addEventListener('click', loadNextScenario);
    repeatScenarioBtn.addEventListener('click', repeatCurrentScenario);
    backToSelectionBtn.addEventListener('click', showScenarioSelection); // New listener for back to selection

    // Listener for the new button on the main sim screen
    if (backToScenarioSelectionFromSimBtn) { // Good practice to check if element exists
        backToScenarioSelectionFromSimBtn.addEventListener('click', showScenarioSelection);
    }


    // Initial state: Hide all main content until name is entered
    mainSimulatorScreen.style.display = 'none';
    scenarioSelectionScreen.style.display = 'none';
});