# Chore Card

Chore Card is a Home Assistant integration and custom Lovelace card that helps you manage household chores efficiently. It allows you to assign chores to users, track completion, and visualize progress—all integrated into Home Assistant.

---

## Features
- Customizable chore categories: Daily, Weekly, and Monthly.
- User assignment via dropdowns.
- Automatically resets chores based on the specified start day of the week.
- Dynamic score tracking for each user.
- Easy YAML configuration for both the card and integration.

---

## Screenshots

### Example Chore Card in Lovelace
![Chore Card Example](./images/chore_card_example.png)

### Example Scorecard
![Scorecard Example](./images/scorecard_example.png)

---

## Installation

### Via HACS
1. Add this repository to HACS.
2. Install the **Chore Card** integration and Lovelace card.
3. Restart Home Assistant.

### Manual Installation
1. Copy the `custom_components/chore_card` folder to your Home Assistant `custom_components` directory.
2. Copy the `www/chore-card/` folder to your Home Assistant `www` directory.
3. Restart Home Assistant.

---

## Configuration

### **YAML Options**
Below are the available options for configuring the Chore Card.

#### **Basic Options**
| Option                  | Type    | Description                                                                                          | Default   |
|-------------------------|---------|------------------------------------------------------------------------------------------------------|-----------|
| `first_day_of_week`     | String  | The first day of the week for resets. Can be a short or long name (e.g., `Mon`, `Monday`).            | `Monday`  |
| `show_long_day_names`   | Boolean | Whether to display long day names (e.g., `Monday` vs. `Mon`).                                        | `false`   |
| `points_position`       | String  | Position of the scorecard. Can be `top` or `bottom`.                                                 | `top`     |
| `day_header_background_color` | String  | Background color for the day headers. Must be a CSS-named color.                                    | `blue`    |
| `day_header_font_color` | String  | Font color for the day headers. Must be a CSS-named color.                                           | `white`   |

#### **User Options**
Each user must be listed under the `users` section:
```yaml
users:
  - name: Alice
    background_color: lightpink
  - name: Bob
    background_color: lightblue
```
| Option             | Type   | Description                                | Default       |
|--------------------|--------|--------------------------------------------|---------------|
| `name`             | String | Name of the user.                         | **Required**  |
| `background_color` | String | Background color for the user’s scorecard. | `transparent` |

#### **Chores Options**
Define your chores under `daily`, `weekly`, and `monthly` sections:
```yaml
chores:
  daily:
    - name: Wash Dishes
      points: 5
  weekly:
    - name: Mop Floors
      points: 10
  monthly:
    - name: Clean Windows
      points: 15
      week_of_month:
        week: 2
        highlight_color: yellow
```
| Option                  | Type    | Description                                                                                          | Default       |
|-------------------------|---------|------------------------------------------------------------------------------------------------------|---------------|
| `name`                 | String  | The name of the chore.                                                                               | **Required**  |
| `points`               | Integer | Points awarded for completing the chore.                                                            | `0`           |
| `week_of_month.week`   | Integer | For monthly chores, specifies the week of the month (e.g., `2` for the second week).                | None          |
| `week_of_month.highlight_color` | String  | Color to highlight the chore during the specified week. Must be a CSS-named color.                 | `green`       |

---

## Example Configuration
```yaml
first_day_of_week: Monday
show_long_day_names: true
points_position: top
day_header_background_color: blue
day_header_font_color: white

users:
  - name: Alice
    background_color: lightpink
  - name: Bob
    background_color: lightblue

chores:
  daily:
    - name: Wash Dishes
      points: 5
  weekly:
    - name: Mop Floors
      points: 10
  monthly:
    - name: Clean Windows
      points: 15
      week_of_month:
        week: 2
        highlight_color: yellow
```

---

## Sensor Attributes
The Chore Card integration provides a sensor for each card. Below are the attributes exposed by the sensor.

| Attribute      | Description                                                |
|----------------|------------------------------------------------------------|
| `chores`       | The list of all configured chores for the card.            |
| `users`        | The list of users associated with the card.                |
| `last_reset`   | The last time the chores were reset automatically.          |

---

## Contributing
Feel free to contribute to this repository by submitting issues or pull requests.

---

## License
This project is licensed under the MIT License.
