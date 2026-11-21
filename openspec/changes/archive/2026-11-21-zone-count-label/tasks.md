# Tasks

## 1. Label

- [x] 1.1 Split the zone label into a shortening name and a fixed count (D1), and move the ellipsis rules from the button to the name for all widths. Verify with an e2e test on a 375-pixel phone:
  - the deck pile "Standard 52" shows its full count "52" in its label;
  - a row of seven columns named "Tableau 1" to "Tableau 7", with 12 cards drawn into "Tableau 3", shows every count in full (the count element is not clipped: its scroll width is not more than its client width, and it lies inside the label's box);
  - an empty zone's slim bar shows "0".

## 2. Verification

- [x] 2.1 Run `e2e/contrast.spec.ts` (the table and its zone labels are covered) and the existing table e2e suites. Then run lint, all unit tests and the full e2e suite, push to `main`, and confirm the deploy.
