import * as jsYaml from 'https://cdn.jsdelivr.net/npm/js-yaml@4.1.0/+esm';

class ChoreCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.data = {}; // Placeholder for chore data
    this.users = []; // Placeholder for users
    this.firstDayOfWeek = 'Mon'; // Default start day
    this.showLongDayNames = false; // Default: short day names
    this.pointsPosition = 'top'; // Default: points at the top
    this.currentDate = new Date(); // Current date
    this.selections = {}; // Track selections for each chore
    this.userPoints = {}; // Track total points for each user
    this.cardId = this.getAttribute('card-id') || `chore-card-${Date.now()}`; // Unique card ID
    this.haToken = ''; // Home Assistant token, must be provided
    this.dayHeaderBackgroundColor = 'blue';
    this.dayHeaderFontColor = 'white';
    this.loadYamlData(); // Load YAML data
  }

  async loadYamlData() {
    try {
      const response = await fetch('/local/chore-card/chores.yaml');
      if (!response.ok) throw new Error(`Failed to load YAML file: ${response.statusText}`);

      const yamlText = await response.text();
      const yamlData = jsYaml.load(yamlText);

      this.firstDayOfWeek = this.normalizeDayName(
        yamlData.first_day_of_week || 'Monday'
      );
      this.showLongDayNames = yamlData.show_long_day_names || false;
      this.pointsPosition = yamlData.points_position || 'top';

      this.dayHeaderBackgroundColor = this.isValidCssColor(yamlData.day_header_background_color)
        ? yamlData.day_header_background_color
        : 'blue';
      this.dayHeaderFontColor = this.isValidCssColor(yamlData.day_header_font_color)
        ? yamlData.day_header_font_color
        : 'white';

      this.users = yamlData.users || [];
      this.data = yamlData.chores || {};

      // Initialize user points
      this.users.forEach((user) => (this.userPoints[user.name] = 0));

      // Load saved state
      await this.loadStateFromHomeAssistant();
      this.checkForReset();
      this.render();
    } catch (error) {
      console.error('Error loading YAML data:', error);
    }
  }

  normalizeDayName(dayName) {
    const shortDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const longDays = [
      'Sunday',
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
    ];

    const normalizedDay = dayName.toLowerCase();
    const shortIndex = shortDays.findIndex(
      (day) => day.toLowerCase() === normalizedDay
    );
    const longIndex = longDays.findIndex(
      (day) => day.toLowerCase() === normalizedDay
    );

    if (shortIndex !== -1) return shortDays[shortIndex];
    if (longIndex !== -1) return shortDays[longIndex];

    throw new Error(`Invalid first_day_of_week: ${dayName}`);
  }

  isValidCssColor(color) {
    const s = new Option().style;
    s.color = color;
    return s.color !== ''; // If the browser accepts the color, it's valid
  }

  async checkForReset() {
    const today = new Date();
    const firstDayOfWeekIndex = this.getDayIndex(this.firstDayOfWeek);

    if (today.getDay() === firstDayOfWeekIndex) {
      console.log(`Resetting chores for card: ${this.cardId}`);
      await this.resetWeeklyChores();
    }
  }

  async resetWeeklyChores() {
    if (this.data.weekly) {
      this.data.weekly.forEach((chore) => {
        chore.selections = Array(7).fill(null); // Clear weekly selections
      });
      await this.saveStateToHomeAssistant();
      this.render();
    }
  }

  async saveStateToHomeAssistant() {
    try {
      const state = {
        cardId: this.cardId,
        data: this.data,
        userPoints: this.userPoints,
      };

      const response = await fetch(`/api/states/sensor.${this.cardId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.haToken}`,
        },
        body: JSON.stringify({ state: JSON.stringify(state) }),
      });

      if (!response.ok) {
        throw new Error(`Failed to save state: ${response.statusText}`);
      }
      console.log(`State saved for card: ${this.cardId}`);
    } catch (error) {
      console.error('Error saving state to Home Assistant:', error);
    }
  }

  async loadStateFromHomeAssistant() {
    try {
      const response = await fetch(`/api/states/sensor.${this.cardId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.haToken}`,
        },
      });

      if (response.ok) {
        const state = await response.json();
        const savedState = JSON.parse(state.state);

        this.data = savedState.data || this.data;
        this.userPoints = savedState.userPoints || this.userPoints;

        console.log(`State loaded for card: ${this.cardId}`);
      } else {
        console.warn(`No saved state found for card: ${this.cardId}`);
      }
    } catch (error) {
      console.error(`Error loading state for card: ${this.cardId}`, error);
    }
  }

  getDayIndex(day) {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return days.indexOf(day);
  }

  render() {
    this.shadowRoot.innerHTML = '';

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/local/chore-card/chore-card.css'; // Path to the CSS file
    this.shadowRoot.appendChild(link);

    const scorecard = this.renderScorecard();
    this.shadowRoot.innerHTML += `
      <div class="card">
        ${this.pointsPosition === 'top' ? scorecard : ''}
        <div class="grid">
          <div></div>
          ${this.renderWeekDays()}
          <div class="empty-row"></div>
          ${this.data.daily ? this.renderChoreGrid('Daily Chores', this.data.daily, 'daily') : ''}
          ${this.data.weekly ? this.renderChoreGrid('Weekly Chores', this.data.weekly, 'weekly') : ''}
          ${this.data.monthly ? this.renderChoreGrid('Monthly Chores', this.data.monthly, 'monthly') : ''}
        </div>
        ${this.pointsPosition === 'bottom' ? scorecard : ''}
      </div>
    `;
  }

  renderWeekDays() {
    const shortDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const longDays = [
      'Sunday',
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
    ];

    const daysOfWeek = this.showLongDayNames ? longDays : shortDays;
    const startIndex = shortDays.indexOf(this.firstDayOfWeek);

    if (startIndex === -1) {
      console.error('Invalid first_day_of_week:', this.firstDayOfWeek);
      return '<div class="day-header">Invalid Week Start</div>';
    }

    const orderedDays = [
      ...daysOfWeek.slice(startIndex),
      ...daysOfWeek.slice(0, startIndex),
    ];

    return orderedDays
      .map(
        (day) =>
          `<div class="day-header" style="background-color: ${this.dayHeaderBackgroundColor}; color: ${this.dayHeaderFontColor};">${day}</div>`
      )
      .join('');
  }

  renderChoreGrid(header, chores, section) {
    if (!chores.length) return '';

    let html = `<div class="section-header" style="text-align: left;">${header}</div>`;

    html += chores
      .map((chore, rowIndex) =>
        `<div class="chore-name">
          ${chore.name}
        </div>${Array(7)
          .fill(this.renderCell(section, rowIndex, chore))
          .join('')}`
      )
      .join('');

    return html;
  }

  renderCell(section, rowIndex, chore) {
    const options = this.users
      .map((user) => `<option value="${user.name}">${user.name}</option>`)
      .join('');

    return `
      <div class="grid-cell">
        <select 
          class="user-dropdown" 
          data-section="${section}" 
          data-row="${rowIndex}" 
          onchange="this.getRootNode().host.handleDropdownChange(event)">
          <option value=""></option>
          ${options}
        </select>
      </div>
    `;
  }

  renderScorecard() {
    const userScores = this.users
      .map((user) => {
        const backgroundColor = user.backgroundColor || 'transparent';
        const points = this.userPoints[user.name] || 0;
        return `<div class="user-score" style="background-color: ${backgroundColor};">
          <strong>${user.name}: ${points}</strong>
        </div>`;
      })
      .join('');

    return `
      <div class="scorecard">
        <div class="user-scores-row">
          ${userScores}
        </div>
      </div>
    `;
  }

  handleDropdownChange(event) {
    const dropdown = event.target;
    const section = dropdown.dataset.section;
    const rowIndex = dropdown.dataset.row;
    const selectedValue = dropdown.value;

    const chore = this.data[section][rowIndex];
    const points = chore.points || 0;

    if (selectedValue) {
      this.userPoints[selectedValue] += points;
    } else {
      const previousUser = Array.from(dropdown.options).find(
        (option) => option.selected
      ).value;
      if (previousUser) {
        this.userPoints[previousUser] -= points;
      }
    }

    chore.selections = chore.selections || Array(7).fill(null);
    chore.selections[rowIndex] = selectedValue;

    this.saveStateToHomeAssistant();
    this.render();
  }
}

customElements.define('chore-card', ChoreCard);
