
# Chore Card for Home Assistant

The **Chore Card** is a customizable Lovelace dashboard card for tracking and managing chores. It allows you to assign chores to users, track points, and reset schedules automatically. This card supports **daily**, **weekly**, and **monthly** chores with advanced customization options.

## Features
- Assign chores to users with a dropdown for each day.
- Highlight monthly chores based on the week of the month.
- Automatically reset chore schedules on the first day of the week.
- Track and display points for each user.
- Support for long and short day names.
- Fully customizable with **CSS named colors** for backgrounds, headers, and user scores.

---

## Installation

Use HACS or
  
1. **Download the Files**:
   Clone or download the repository and copy the following files to your Home Assistant setup:
   - `chore-card.js`
   - `chore-card.css`

2. **Add to Lovelace Resources**:
   Navigate to **Settings > Dashboards > Resources** and add:
   ```yaml
   URL: /local/chore-card.js
   Type: JavaScript Module
   ```

3. **Restart Home Assistant**:
   Restart Home Assistant to apply the changes.

---

## Configuration

### Lovelace Configuration Example
Add the following configuration to your Lovelace dashboard YAML file or via the UI editor:

```yaml
title: Home Dashboard
views:
  - title: Chore Card
    path: chorecard
    badges: []
    cards:
      - type: custom:chore-card
        title: Chore Tracker
        first_day_of_week: Monday
        show_long_day_names: true
        points_position: top
        day_header_background_color: lightblue
        day_header_font_color: black
        current_day_background_color: red
        current_day_font_color: white
        users:
          - name: Alice
            background_color: lightpink
            font_color: black
          - name: Bob
            background_color: lightgreen
        chores:
          daily:
            - name: Wash Dishes
              points: 5
            - name: Sweep Floor
              points: 3
          weekly:
            - name: Mop Floors
              points: 10
              days: Monday
            - name: Vacuum
              points: 8
            - name: Take out garbage
              points: 1
              days: Mon, Thu
          monthly:
            - name: Clean Windows
              points: 15
              week_of_month:
                week: 1
                highlight_color: green
            - name: Organize Garage
              points: 20
              week_of_month:
                week: 3
                highlight_color: orange
              max_days: 2
```

---

## Functionality

### General
- The card dynamically adjusts the UI based on the day of the week and chore schedule.
- Points are updated automatically whenever a dropdown selection is made.
- The dropdowns reset when the first day of the week occurs.

### Daily Chores
- Standard daily tasks that reset every week.

### Weekly Chores
- Dropdowns are disabled when:
  - A name is selected for the day.
  - The chore is scheduled for a specific day and a selection is made.
- Weekly chores automatically reset on the first day of the week.

### Monthly Chores
- Chores are highlighted during their specified week using `week_of_month` and `highlight_color`.
- If `max_days` is defined, dropdowns disable once the maximum days are completed.
- Reset behavior is based on the first day of the week.

---

## Display Options

| Option                      | Type    | Default        | Description                                                |
|-----------------------------|---------|----------------|------------------------------------------------------------|
| `first_day_of_week`         | String  | `Monday`       | Sets the starting day of the week.                        |
| `show_long_day_names`       | Boolean | `false`        | Toggles between short (`Mon`) and long (`Monday`) day names.|
| `points_position`           | String  | `top`          | Positions the points display (`top` or `bottom`).          |
| `day_header_background_color` | String | `blue`         | Background color for the day headers.                     |
| `day_header_font_color`     | String  | `white`        | Font color for the day headers.                           |
| `current_day_background_color` | String | `red`         | Background color for the day headers.                     |
| `current_day_font_color`     | String  | `white`        | Font color for the day headers.                           |

## User Options

| Option                      | Type    | Default        | Description                                                |
|-----------------------------|---------|----------------|------------------------------------------------------------|
| `name`                     | String   | ``             | User name                                                  |
| `background_color`          | String  | `transparent`  | Background color for the name.                      |
| `font_color`                | String  | `white`        | Font color for the name.                      |

## Chore Options

| Option                      | Type    | Default  | Section   | Description                                                |
|-----------------------------|---------|----------|-----------|------------------------------------------------------------|
| `name`                      | String   | ``      | `All`     | chore name                                                  |
| `points`                    | Integer  | ``      | `All`     | Points for the chore   |
| `days`                      | String   | ``      | `Weekly`  | Days of the week the chore is done                      |
| `week`                      | String   | ``      | `Monthly` | Week of the month the chore is done based on the first day of the week |
| `highlight_color`           | String   | `red`   | `Monthly` | Background color for the chore if the week is set          |
| `max_days`                  | String   | `1`     | `Monthly` | How many days the chore will take to do.          |

---

## Contributing
Feel free to contribute to this repository by submitting issues or pull requests.

---

## License
This project is licensed under the MIT License.
