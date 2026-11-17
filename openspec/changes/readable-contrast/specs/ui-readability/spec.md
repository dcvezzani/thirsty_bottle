# Spec Delta

## Purpose

Keeps every screen legible: text, placeholders and controls must contrast with whatever they sit on (table felt, panels, sheets, drawers), in light and dark color schemes and at phone and desktop sizes.

## ADDED Requirements

### Requirement: Text contrast
Visible text SHALL have a contrast ratio of at least 4.5:1 against its effective background. Large text (at least 18.66px bold or 24px regular) and the borders and icons of interactive controls SHALL have at least 3:1. This applies to both the light and dark color schemes.

#### Scenario: Sheet over the felt
- **WHEN** a player opens the Draw sheet from a pile on the table
- **THEN** the sheet's title, labels, option buttons and selected value all meet the text contrast threshold against the sheet's background

#### Scenario: Dark color scheme
- **WHEN** the device uses a dark color scheme and a player opens any sheet, drawer or form
- **THEN** its text still meets the text contrast threshold

### Requirement: Controls do not inherit surrounding text color
A control or surface that draws its own background (text box, menu, text area, button, sheet, drawer) SHALL use a text color chosen for that background. It SHALL NOT inherit text color from the area it sits on. Only controls styled for the felt itself MAY use the felt's light text.

#### Scenario: Counter entry on the felt
- **WHEN** a player types a counter name into the counter text box that sits on the table felt
- **THEN** the typed text and the Add button label are dark on the light control background, and remain readable

#### Scenario: Felt-styled controls stay light
- **WHEN** the table's top bar, seat markers, selection bar and counter +/− buttons are shown on the felt
- **THEN** their text remains light on the dark felt and meets the contrast threshold

### Requirement: Placeholder legibility
Placeholder text in inputs SHALL be visibly distinct from entered text, and SHALL have at least 3:1 contrast against the input background.

#### Scenario: Empty counter field
- **WHEN** the counter text box is empty
- **THEN** its placeholder hint is legible and clearly lighter than typed text

### Requirement: Readability is verified automatically
The project SHALL include an automated check that measures the contrast of visible text and controls on the lobby, deck editor and table screens. It SHALL cover the table with a sheet, the drawer and the counters open, in light and dark color schemes at phone and desktop sizes, and SHALL fail when any element falls below its threshold.

#### Scenario: Regression caught
- **WHEN** a style change makes the text of a control on the table the same color as its background
- **THEN** the automated contrast check fails and names the element and its measured ratio
