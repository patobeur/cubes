/**
 * UI Management Module
 * Handles the real-time status panel.
 */

let Factions = [];
let Agents = [];
let Houses = [];
let lastUpdate = 0;
const UPDATE_INTERVAL = 1000 / 10; // 10 FPS is enough for a status panel

const statusPanel = document.getElementById('status-panel');

export function initUI(agents, houses, factions) {
    Agents = agents;
    Houses = houses;
    Factions = factions;
    console.log("UI Initialized");
}

function getAgentEmoji(role) {
    switch (role) {
        case 'ramasseur': return '📦';
        case 'tank': return '🛡️';
        case 'dps': return '⚔️';
        case 'healer': return '❤️';
        default: return '❓';
    }
}

export function updateUI(now) {
    if (!statusPanel || (now - lastUpdate < UPDATE_INTERVAL)) return;
    lastUpdate = now;

    let content = '<h1 class="text-lg font-bold mb-2">Faction Status</h1>';

    Factions.forEach(faction => {
        const house = Houses.find(h => h.id === faction.id);
        const factionAgents = Agents.filter(a => a.faction === faction.id);

        content += `<div class="mb-4 p-2 rounded" style="background-color: ${faction.color}20;">`; // Faction container with semi-transparent background
        content += `<h2 class="text-md font-bold" style="color: ${faction.color}; text-shadow: 0 0 3px #000;">${faction.name}</h2>`;

        // House Info
        content += `<div class="pl-2 border-l-2" style="border-color: ${faction.color};">`;
        content += `<div><strong>🏠 House:</strong> ${house ? house.storedResources : 'N/A'} resources</div>`;

        // Agents Info
        factionAgents.forEach(agent => {
            const emoji = getAgentEmoji(agent.role);
            let targetInfo = '';
            if (agent.state === 'escort_gatherer' && agent.target) {
                targetInfo = ` (Protecting ${agent.target.role})`;
            } else if (agent.state === 'seek_resource' && agent.targetResource) {
                targetInfo = ` (Targeting Resource)`;
            }

            content += `<div><strong>${emoji} ${agent.role}:</strong> ${agent.state}${targetInfo}</div>`;
        });

        content += `</div></div>`; // Close border and faction container
    });

    statusPanel.innerHTML = content;
}