# Spec Delta

## ADDED Requirements

### Requirement: Behind an HTTPS reverse proxy
When deployed behind a platform reverse proxy that terminates TLS, the server SHALL honor the proxy's forwarded protocol and client address headers. Absolute URLs it generates (such as image links in deck exports) SHALL then use `https`, and the client SHALL connect its WebSocket with `wss`.

#### Scenario: Export behind the proxy
- **WHEN** a player exports a deck as JSON through the production HTTPS address
- **THEN** the image URLs in the manifest start with `https://`
