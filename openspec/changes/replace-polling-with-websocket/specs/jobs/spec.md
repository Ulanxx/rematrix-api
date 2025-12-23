## MODIFIED Requirements
### Requirement: Job Status Monitoring
The system SHALL support both polling and WebSocket-based job status monitoring.

#### Scenario: Client requests job status via WebSocket
- **WHEN** a client connects to WebSocket with jobId parameter
- **THEN** the system SHALL send current job status immediately upon connection
- **AND** the system SHALL push status updates when job state changes
- **AND** the status data SHALL match the REST API response structure

#### Scenario: Job status changes during execution
- **WHEN** a job transitions between stages (PLAN → OUTLINE → STORYBOARD, etc.)
- **THEN** the system SHALL broadcast the status change to all WebSocket clients
- **AND** the system SHALL include stage name, status, and progress information
- **AND** the system SHALL maintain backward compatibility with REST polling

#### Scenario: Frontend switches from polling to WebSocket
- **WHEN** the frontend application establishes WebSocket connection
- **THEN** the system SHALL accept the connection and replace polling requests
- **AND** the system SHALL provide identical status data format
- **AND** the system SHALL allow fallback to polling if WebSocket fails
