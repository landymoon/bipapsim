document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const welcomeScreen = document.getElementById('welcomeScreen');
    const firstNameInput = document.getElementById('firstNameInput');
    const startButton = document.getElementById('startButton');

    const modeSelectionScreen = document.getElementById('modeSelectionScreen');
    const bipapModeBtn = document.getElementById('bipapModeBtn');
    const ventilatorModeBtn = document.getElementById('ventilatorModeBtn');
    const userNameModeScreen = document.getElementById('userNameModeScreen');

    const scenarioSelectionScreen = document.getElementById('scenarioSelectionScreen');
    const scenarioWelcomeTitle = document.getElementById('scenarioWelcomeTitle');
    const scenarioGrid = document.getElementById('scenarioGrid');

    const mainSimulatorScreen = document.getElementById('mainSimulatorScreen');
    const rtNamePlaceholder = document.getElementById('rtNamePlaceholder');

    const ipapInput = document.getElementById('ipap');
    const epapInput = document.getElementById('epap');
    const fio2Input = document.getElementById('fio2');
    const submitBtn = document.getElementById('submitBtn');

    const phResult = document.getElementById('phResult');
    const paco2Result = document.getElementById('paco2Result');
    const pao2Result = document.getElementById('pao2Result');
    const vtResult = document.getElementById('vtResult');

    const scenarioText = document.getElementById('scenarioText');
    const initialPH = document.getElementById('initialPH');
    const initialPaCO2 = document.getElementById('initialPaCO2');
    const initialPaO2 = document.getElementById('initialPaO2');

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

    const backToScenarioSelectionFromSimBtn = document.getElementById('backToScenarioSelectionFromSimBtn');

    // Feedback Popup ABG Elements
    const initialAbgPhFb = document.getElementById('initialAbgPhFb');
    const initialAbgPaco2Fb = document.getElementById('initialAbgPaco2Fb');
    const initialAbgPao2Fb = document.getElementById('initialAbgPao2Fb');

    const finalAbgPhFb = document.getElementById('finalAbgPhFb');
    const finalAbgPaco2Fb = document.getElementById('finalAbgPaco2Fb');
    const finalAbgPao2Fb = document.getElementById('finalAbgPao2Fb');
    const finalAbgVtFb = document.getElementById('finalAbgVtFb');


    // --- Global Variables ---
    let userName = '';
    let currentScenario = null;
    let currentScenarioIndex = -1;
    let initialBIPAPSettingsForScenario = {};
    let finalBIPAPSettingsApplied = {};

    // --- Target ABG Ranges for "Fixed" State ---
    const TARGET_PH_MIN = 7.35;
    const TARGET_PH_MAX = 7.45;
    const TARGET_PACO2_MIN = 35;
    const TARGET_PACO2_MAX = 45;
    const TARGET_PAO2_MIN = 80;
    const TARGET_PAO2_MAX = 100;

    // --- ABG and Vt Simulation Logic ---
    function simulateABG(currentIpap, currentEpap, currentFiO2, scenarioInitialABGValues, scenarioInitialBIPAP) {
        const initialPhFromScenario = parseFloat(scenarioInitialABGValues.pH);
        const initialPaco2FromScenario = parseFloat(scenarioInitialABGValues.paco2);
        const initialPao2FromScenario = parseFloat(scenarioInitialABGValues.pao2);

        let effectiveHco3 = (0.03 * initialPaco2FromScenario) * Math.pow(10, (initialPhFromScenario - 6.1));
        effectiveHco3 = Math.max(10, Math.min(50, effectiveHco3));

        const currentPs = currentIpap - currentEpap;
        const initialPsScenario = scenarioInitialBIPAP.ipap - scenarioInitialBIPAP.epap;

        const BASE_VT = 300;
        const VT_PER_PS = 50;
        let simulatedVt = BASE_VT + (currentPs * VT_PER_PS);
        // MODIFIED: Tidal volume capped at 1000 mL
        simulatedVt = Math.round(Math.max(150, Math.min(1000, simulatedVt))); //
        if (currentPs < 0) simulatedVt = 150; // Ensure minimum Vt if PS is negative (IPAP < EPAP)


        const paco2ChangeFactor = 7;
        let paco2Change = (initialPsScenario - currentPs) * paco2ChangeFactor;
        let newPaco2 = initialPaco2FromScenario + paco2Change;
        newPaco2 = Math.round(Math.max(20, Math.min(90, newPaco2)));

        let pao2ChangeFromFiO2 = (currentFiO2 - scenarioInitialBIPAP.fio2) * 1.5;
        let pao2ChangeFromEpap = (currentEpap - scenarioInitialBIPAP.epap) * 3;
        let newPao2 = initialPao2FromScenario + pao2ChangeFromFiO2 + pao2ChangeFromEpap;
        newPao2 = Math.round(Math.max(30, Math.min(600, newPao2)));

        if (newPaco2 <= 0) newPaco2 = 0.01;
        let newPh = 6.1 + Math.log10(effectiveHco3 / (0.03 * newPaco2));
        newPh = Math.max(6.8, Math.min(7.8, newPh));

        return {
            pH: newPh.toFixed(2),
            PaCO2: newPaco2,
            PaO2: newPao2,
            Vt: simulatedVt
        };
    }

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

    // --- Scenario Definitions (imageKeywords removed) ---
    const scenarios = [
        {
            name: "COPD Exacerbation with Acute Respiratory Acidosis",
            shortDescription: "Manage a patient with severe COPD exacerbation and high CO2.",
            initial: { pH: 7.28, paco2: 65, pao2: 55 },
            initialBIPAP: { ipap: 12, epap: 5, fio2: 40 }, // PS 7 -> Vt 650
            text: "A 68-year-old male with severe COPD is admitted with acute exacerbation. He's dyspneic, using accessory muscles, and is on BIPAP with the shown settings. His current ABG reflects significant respiratory acidosis and hypoxemia. As RT {name}, your task is to adjust BIPAP settings to improve his ventilation and oxygenation."
        },
        {
            name: "Acute Hypoxemic Respiratory Failure (Pneumonia)",
            shortDescription: "Improve oxygenation in a patient with severe pneumonia.",
            initial: { pH: 7.42, paco2: 38, pao2: 45 },
            initialBIPAP: { ipap: 15, epap: 8, fio2: 60 }, // PS 7 -> Vt 650
            text: "A 55-year-old female with severe pneumonia is experiencing acute hypoxemic respiratory failure. Despite high FiO2 and EPAP on BIPAP with the shown settings, she remains significantly hypoxemic. Her ventilation is adequate. As RT {name}, adjust settings to improve oxygenation without causing hyperventilation."
        },
        {
            name: "Hypercapnic Respiratory Failure (CHF Exacerbation)",
            shortDescription: "Correct severe hypercapnia in a heart failure patient.",
            initial: { pH: 7.25, paco2: 71, pao2: 65 },
            initialBIPAP: { ipap: 18, epap: 6, fio2: 30 }, // PS 12 -> Vt 900
            text: "A 72-year-old male with acute decompensated heart failure is in severe hypercapnic respiratory failure, currently on BIPAP with the shown settings. He is breathing rapidly but unable to clear CO2 effectively. As RT {name}, improve his ventilation to correct the acidosis and support his breathing."
        },
        {
            name: "Post-Extubation Respiratory Distress",
            shortDescription: "Support breathing and prevent re-intubation after extubation.",
            initial: { pH: 7.32, paco2: 52, pao2: 70 },
            initialBIPAP: { ipap: 14, epap: 6, fio2: 50 }, // PS 8 -> Vt 700
            text: "A 45-year-old patient, recently extubated, is showing signs of respiratory distress with mild hypercapnia and hypoxemia, currently on BIPAP with the shown settings. As RT {name}, optimize settings to support his breathing and prevent re-intubation."
        },
        {
            name: "COPD Exacerbation with Severe Hypoxemia",
            shortDescription: "Manage a COPD patient with critically low oxygen and moderate CO2 retention.",
            initial: { pH: 7.33, paco2: 58, pao2: 42 },
            initialBIPAP: { ipap: 14, epap: 7, fio2: 50 }, // PS 7 -> Vt 650
            text: "A 71-year-old female with a long history of COPD presents to the ED with worsening shortness of breath and cyanosis. She is alert but struggling to speak in full sentences. Current BIPAP settings are shown. As RT {name}, your priority is to rapidly improve her oxygenation while managing her ventilation."
        },
        {
            name: "Aspiration Pneumonia with Respiratory Acidosis",
            shortDescription: "Treat a patient with aspiration pneumonia leading to poor oxygenation and high CO2.",
            initial: { pH: 7.26, paco2: 70, pao2: 50 },
            initialBIPAP: { ipap: 16, epap: 6, fio2: 60 }, // PS 10 -> Vt 800
            text: "A 60-year-old male with a recent stroke and dysphagia developed aspiration pneumonia. He is lethargic and tachypneic. Initial BIPAP settings are applied. As RT {name}, focus on improving both oxygenation and ventilation to correct the severe respiratory acidosis."
        },
        {
            name: "Cardiogenic Pulmonary Edema (CHF) with Mild Hypercapnia",
            shortDescription: "Support a heart failure patient with pulmonary edema and developing CO2 retention.",
            initial: { pH: 7.31, paco2: 55, pao2: 60 },
            initialBIPAP: { ipap: 12, epap: 8, fio2: 70 }, // PS 4 -> Vt 500
            text: "A 78-year-old male with known congestive heart failure (CHF) is admitted with acute dyspnea, bilateral crackles, and frothy sputum. He is on BIPAP as shown. While oxygenation is a concern, he is also starting to retain CO2. As RT {name}, adjust settings to improve gas exchange and reduce work of breathing."
        },
        {
            name: "Obesity Hypoventilation Syndrome (OHS) - Acute on Chronic",
            shortDescription: "Manage acute respiratory failure in a patient with OHS.",
            initial: { pH: 7.25, paco2: 80, pao2: 48 },
            initialBIPAP: { ipap: 20, epap: 10, fio2: 40 }, // PS 10 -> Vt 800
            text: "A 52-year-old patient with a BMI of 45 and diagnosed Obesity Hypoventilation Syndrome is admitted with somnolence and severe respiratory distress. Current BIPAP settings are high but may need adjustment. As RT {name}, your goal is to significantly improve ventilation and normalize pH, being mindful of their chronic CO2 retention."
        },
        {
            name: "Post-Operative Atelectasis with Hypoxemia",
            shortDescription: "Address hypoxemia in a post-surgical patient due to lung collapse.",
            initial: { pH: 7.43, paco2: 40, pao2: 58 },
            initialBIPAP: { ipap: 10, epap: 5, fio2: 50 }, // PS 5 -> Vt 550
            text: "A 65-year-old patient, 2 days post-abdominal surgery, is found to be hypoxemic with diminished breath sounds at the bases. Chest X-ray suggests bibasilar atelectasis. BIPAP is initiated with the displayed settings. As RT {name}, optimize settings to recruit alveoli and improve oxygenation."
        },
        {
            name: "Severe Asthma Exacerbation with Impending Fatigue",
            shortDescription: "Support a severe asthmatic with significant airflow obstruction and rising CO2.",
            initial: { pH: 7.29, paco2: 62, pao2: 65 },
            initialBIPAP: { ipap: 15, epap: 5, fio2: 40 }, // PS 10 -> Vt 800
            text: "A 30-year-old known asthmatic is in severe distress with minimal air entry despite continuous nebulizers. They are tiring, and their CO2 is rising. BIPAP has been started. As RT {name}, adjust settings to reduce work of breathing and improve ventilation, carefully monitoring for air trapping."
        },
        {
            name: "Pulmonary Embolism with Mild Respiratory Alkalosis & Hypoxemia",
            shortDescription: "Manage hypoxemia in a patient with PE who is tachypneic.",
            initial: { pH: 7.48, paco2: 32, pao2: 55 },
            initialBIPAP: { ipap: 10, epap: 6, fio2: 60 }, // PS 4 -> Vt 500
            text: "A 58-year-old patient presents with sudden onset chest pain and severe dyspnea. A pulmonary embolism is suspected and later confirmed. The patient is tachypneic. BIPAP is initiated primarily for hypoxemia. As RT {name}, optimize oxygenation. Be aware that high pressures may not be well-tolerated if hemodynamically unstable."
        },
        {
            name: "Sleep Apnea Patient on Home CPAP Admitted with Respiratory Infection",
            shortDescription: "Transition a home CPAP user to BIPAP due to acute illness and increased WOB.",
            initial: { pH: 7.30, paco2: 60, pao2: 52 },
            initialBIPAP: { ipap: 12, epap: 8, fio2: 45 }, // PS 4 -> Vt 500
            text: "A 62-year-old male who uses CPAP at 8 cmH2O nightly for OSA is admitted with a severe chest infection. He is now showing signs of respiratory fatigue and CO2 retention, requiring more support than his CPAP can provide. As RT {name}, adjust BIPAP settings to manage his acute respiratory compromise."
        },
        {
            name: "Near-Drowning with Hypoxemic Respiratory Failure",
            shortDescription: "Manage severe hypoxemia after a near-drowning incident.",
            initial: { pH: 7.36, paco2: 37, pao2: 40 },
            initialBIPAP: { ipap: 14, epap: 10, fio2: 100 }, // PS 4 -> Vt 500
            text: "A 25-year-old was rescued from a near-drowning incident and presents with severe hypoxemia and signs of pulmonary edema. They are on 100% FiO2 via BIPAP. As RT {name}, your focus is to optimize oxygenation using IPAP and EPAP, considering potential for ARDS development."
        }
    ];

    const scenarioColors = [ // Kept for dynamic card colors
        '#f0f8ff', '#faebd7', '#e0ffff', '#f5f5dc', '#ffe4c4',
        '#ffebcd', '#c1e1c1', '#f0fff0', '#f8f8ff', '#fffacd',
        '#e6e6fa', '#fff0f5', '#add8e6', '#f08080', '#afeeee',
        '#d8bfd8', '#ffdead', '#e0eee0', '#fdf5e6', '#faf0e6'
    ];
    if (scenarios.length > scenarioColors.length) {
        console.warn("Not enough unique colors defined for the number of scenarios. Colors may repeat.");
        for(let i = scenarioColors.length; i < scenarios.length; i++) {
            scenarioColors.push(`#${Math.floor(Math.random()*16777215).toString(16).padStart(6, '0')}`);
        }
    }


    function loadScenario(index) {
        currentScenarioIndex = index;
        currentScenario = scenarios[currentScenarioIndex];

        let personalizedText = currentScenario.text.replace('{name}', userName);
        scenarioText.textContent = personalizedText;

        initialPH.textContent = currentScenario.initial.pH;
        initialPaCO2.textContent = currentScenario.initial.paco2;
        initialPaO2.textContent = currentScenario.initial.pao2;

        ipapInput.value = currentScenario.initialBIPAP.ipap;
        epapInput.value = currentScenario.initialBIPAP.epap;
        fio2Input.value = currentScenario.initialBIPAP.fio2;

        initialBIPAPSettingsForScenario = { ...currentScenario.initialBIPAP };

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
            nextIndex = 0;
            alert("You've completed all scenarios! Starting again from the beginning.");
        }
        loadScenario(nextIndex);
        feedbackPopup.style.display = 'none';
    }

    function repeatCurrentScenario() {
        loadScenario(currentScenarioIndex);
        feedbackPopup.style.display = 'none';
    }

    function displayResults(abg) {
        phResult.textContent = abg.pH;
        paco2Result.textContent = abg.PaCO2;
        pao2Result.textContent = abg.PaO2;
        vtResult.textContent = abg.Vt;
    }

    function showFeedback(initialSettings, finalSettings, correctedABG, scenarioProblemABG) {
        feedbackTitle.textContent = `Congratulations, RT ${userName}!`;
        feedbackMessage.textContent = `You successfully managed the patient's ABG.`;

        initialIpapFb.textContent = initialSettings.ipap;
        initialEpapFb.textContent = initialSettings.epap;
        initialFio2Fb.textContent = initialSettings.fio2;

        finalIpapFb.textContent = finalSettings.ipap;
        finalEpapFb.textContent = finalSettings.epap;
        finalFio2Fb.textContent = finalSettings.fio2;

        initialAbgPhFb.textContent = parseFloat(scenarioProblemABG.pH).toFixed(2);
        initialAbgPaco2Fb.textContent = scenarioProblemABG.paco2;
        initialAbgPao2Fb.textContent = scenarioProblemABG.pao2;

        finalAbgPhFb.textContent = correctedABG.pH;
        finalAbgPaco2Fb.textContent = correctedABG.PaCO2;
        finalAbgPao2Fb.textContent = correctedABG.PaO2;
        finalAbgVtFb.textContent = correctedABG.Vt;

        impactList.innerHTML = '';
        if (finalSettings.ipap !== initialSettings.ipap) {
            impactList.innerHTML += `<li>Your IPAP change from ${initialSettings.ipap} to ${finalSettings.ipap} cmH2O impacted ventilation and tidal volume.</li>`;
        } else {
            impactList.innerHTML += `<li>Your **IPAP** setting remained consistent.</li>`;
        }
        if (finalSettings.epap !== initialSettings.epap) {
            impactList.innerHTML += `<li>Your EPAP change from ${initialSettings.epap} to ${finalSettings.epap} cmH2O impacted oxygenation and FRC.</li>`;
        } else {
            impactList.innerHTML += `<li>Your **EPAP** setting remained consistent.</li>`;
        }
        if (finalSettings.fio2 !== initialSettings.fio2) {
            impactList.innerHTML += `<li>Your FiO2 change from ${initialSettings.fio2}% to ${finalSettings.fio2}% directly impacted oxygenation.</li>`;
        } else {
            impactList.innerHTML += `<li>Your **FiO2** setting remained consistent.</li>`;
        }
        feedbackPopup.style.display = 'flex';
    }

    function getRandomColor(index) { // Kept for dynamic card colors
        return scenarioColors[index % scenarioColors.length];
    }

    function generateScenarioCards() {
        scenarioGrid.innerHTML = '';
        scenarios.forEach((scenario, index) => {
            const card = document.createElement('div');
            card.classList.add('scenario-card');
            card.dataset.index = index;
            card.style.backgroundColor = getRandomColor(index);

            const title = document.createElement('h3');
            title.textContent = scenario.name;
            card.appendChild(title);

            const description = document.createElement('p');
            description.textContent = scenario.shortDescription;
            card.appendChild(description);

            card.addEventListener('click', () => {
                loadScenario(index);
                scenarioSelectionScreen.style.display = 'none';
                mainSimulatorScreen.style.display = 'flex';
            });
            scenarioGrid.appendChild(card);
        });
    }

    function showModeSelection() {
        welcomeScreen.style.display = 'none';
        scenarioSelectionScreen.style.display = 'none';
        mainSimulatorScreen.style.display = 'none';
        feedbackPopup.style.display = 'none';
        modeSelectionScreen.style.display = 'flex';
        userNameModeScreen.textContent = userName;
    }


    function showScenarioSelection() {
        mainSimulatorScreen.style.display = 'none';
        feedbackPopup.style.display = 'none';
        modeSelectionScreen.style.display = 'none';
        scenarioSelectionScreen.style.display = 'flex';
        scenarioWelcomeTitle.textContent = `Welcome, RT ${userName}! Choose a BIPAP Scenario:`;
        generateScenarioCards();
    }

    startButton.addEventListener('click', () => {
        const name = firstNameInput.value.trim();
        if (name) {
            userName = name;
            rtNamePlaceholder.textContent = userName;
            showModeSelection();
        } else {
            alert('Please enter your first name to begin!');
        }
    });

    bipapModeBtn.addEventListener('click', () => {
        showScenarioSelection();
    });

    ventilatorModeBtn.addEventListener('click', () => {
        window.location.href = 'vent.html';
    });

    submitBtn.addEventListener('click', () => {
        const ipapString = ipapInput.value;
        const epapString = epapInput.value;
        const fio2String = fio2Input.value;

        // MODIFIED: Validate for whole numbers
        if (!/^\d+$/.test(ipapString) || !/^\d+$/.test(epapString) || !/^\d+$/.test(fio2String)) {
            alert('IPAP, EPAP, and FiO2 values must be whole numbers.');
            return;
        }

        const ipap = parseInt(ipapString, 10);
        const epap = parseInt(epapString, 10);
        const fio2 = parseInt(fio2String, 10);

        // Validate IPAP >= EPAP
        if (ipap < epap) {
            alert('IPAP must be greater than or equal to EPAP.');
            return;
        }

        // Validate ranges
        if (ipap < 4 || ipap > 30) { //
            alert('IPAP should be between 4 and 30 cmH2O.'); //
            return;
        }
        if (epap < 4 || epap > 20) { //
            alert('EPAP should be between 4 and 20 cmH2O.'); //
            return;
        }
        if (fio2 < 21 || fio2 > 100) { //
            alert('FiO2 should be between 21% and 100%.'); //
            return;
        }

        const simulatedABG = simulateABG(
            ipap, epap, fio2,
            currentScenario.initial,
            currentScenario.initialBIPAP
        );
        displayResults(simulatedABG);
        finalBIPAPSettingsApplied = { ipap, epap, fio2 };

        if (isABGNormalized(simulatedABG)) {
            showFeedback(initialBIPAPSettingsForScenario, finalBIPAPSettingsApplied, simulatedABG, currentScenario.initial);
        }
    });

    nextScenarioBtn.addEventListener('click', loadNextScenario);
    repeatScenarioBtn.addEventListener('click', repeatCurrentScenario);

    // Modified backToSelectionBtn to go to mode selection
    backToSelectionBtn.addEventListener('click', () => {
        feedbackPopup.style.display = 'none';
        showModeSelection();
    });


    if (backToScenarioSelectionFromSimBtn) {
        // Modified to go to mode selection
        backToScenarioSelectionFromSimBtn.addEventListener('click', () => {
            mainSimulatorScreen.style.display = 'none';
            showModeSelection();
        });
    }

    // Initial screen states
    welcomeScreen.style.display = 'flex'; // Start with welcome screen
    modeSelectionScreen.style.display = 'none';
    mainSimulatorScreen.style.display = 'none';
    scenarioSelectionScreen.style.display = 'none';
});