## ADDED Requirements
### Requirement: WebSocket Real-time Workflow Monitoring
The system SHALL provide WebSocket connections for real-time workflow status monitoring.

#### Scenario: Client connects to workflow monitoring
- **WHEN** a client establishes WebSocket connection with jobId parameter
- **THEN** the system SHALL join the client to a job-specific room
- **AND** the system SHALL send current workflow status immediately
- **AND** the system SHALL subscribe the client to all subsequent status updates

#### Scenario: Workflow status changes
- **WHEN** a workflow stage changes status (running/completed/failed)
- **THEN** the system SHALL broadcast status update to all clients in the job room
- **AND** the update SHALL include stage name, status, and timestamp
- **AND** the system SHALL maintain message ordering consistency

#### Scenario: Client disconnects unexpectedly
- **WHEN** a WebSocket connection is lost
- **THEN** the system SHALL clean up room membership
- **AND** the system SHALL log the disconnection for monitoring
- **AND** the system SHALL allow reconnection with the same jobId

#### Scenario: Multiple clients monitor same job
- **WHEN** multiple clients connect to the same jobId
- **THEN** the system SHALL broadcast updates to all connected clients
- **AND** each client SHALL receive identical status information
- **AND** the system SHALL handle concurrent connections efficiently

## MODIFIED Requirements
### Requirement: Workflow Status Updates
The system SHALL support both REST API polling and WebSocket push for workflow status updates.

#### Scenario: Client chooses monitoring method
- **WHEN** a client requests workflow status
- **THEN** the system SHALL support both GET /jobs/:id (polling) and WebSocket (push)
- **AND** both methods SHALL return identical status data structure
- **AND** the system SHALL maintain backward compatibility with existing polling clients

#### Scenario: Workflow engine emits events
- **WHEN** the workflow engine processes a stage transition
- **THEN** the system SHALL emit events for both REST API and WebSocket consumers
- **AND** events SHALL include job status, current stage, and completion percentage
- **AND** the system SHALL ensure event delivery to all active subscribers
