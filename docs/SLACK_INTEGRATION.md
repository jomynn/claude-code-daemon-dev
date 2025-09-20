# Slack Integration for Claude Code Daemon

This guide provides comprehensive instructions for setting up and configuring Slack integration with the Claude Code Daemon, enabling you to monitor, control, and interact with your development environment directly from Slack.

## 🚀 Features

- **Interactive Bot Commands**: Control Claude Code and BMAD workflows directly from Slack
- **Real-time Notifications**: Get alerts, status updates, and project notifications
- **Custom Channel Configuration**: Route different types of messages to specific channels
- **Rich Message Formatting**: Beautiful formatted messages with interactive elements
- **Health Monitoring**: Real-time system health and performance updates
- **Project Management**: Start/stop projects, monitor workflows, and track progress

## 📋 Prerequisites

- A Slack workspace where you have permission to install apps
- Claude Code Daemon running (version 1.0.0+)
- Node.js environment with required dependencies installed

## 🔧 Step 1: Create a Slack App

### 1.1 Create the App
1. Go to [api.slack.com/apps](https://api.slack.com/apps)
2. Click **"Create New App"** → **"From scratch"**
3. Enter app name: `Claude Code Daemon`
4. Select your workspace
5. Click **"Create App"**

### 1.2 Configure Bot Permissions
Navigate to **"OAuth & Permissions"** and add these **Bot Token Scopes**:

```
app_mentions:read     - Read mentions of your app
chat:write           - Send messages as the bot
chat:write.public    - Send messages to public channels
channels:read        - View basic info about public channels
groups:read          - View basic info about private channels
im:read              - View basic info about direct messages
commands             - Add shortcuts and/or slash commands
```

### 1.3 Enable Socket Mode
1. Go to **"Socket Mode"** in the sidebar
2. Enable Socket Mode
3. Generate an **App-Level Token** with scope: `connections:write`
4. Save the token (starts with `xapp-`)

### 1.4 Configure Event Subscriptions
In **"Event Subscriptions"**, subscribe to these **bot events**:
```
app_mention          - When your app is mentioned
message.im           - Messages in direct messages
```

### 1.5 Create Slash Commands
Go to **"Slash Commands"** and create these commands:

| Command | Description | Request URL |
|---------|-------------|-------------|
| `/claude-help` | Show all available commands | `https://your-domain.com/api/slack/command` |
| `/claude-status` | Get system status | `https://your-domain.com/api/slack/command` |
| `/claude-projects` | List all projects | `https://your-domain.com/api/slack/command` |
| `/claude-start` | Start Claude Code for a project | `https://your-domain.com/api/slack/command` |
| `/claude-stop` | Stop Claude Code for a project | `https://your-domain.com/api/slack/command` |
| `/claude-bmad` | Start BMAD workflow | `https://your-domain.com/api/slack/command` |
| `/claude-logs` | Get recent logs | `https://your-domain.com/api/slack/command` |
| `/claude-alerts` | Get recent alerts | `https://your-domain.com/api/slack/command` |
| `/claude-usage` | Get usage statistics | `https://your-domain.com/api/slack/command` |
| `/claude-health` | Perform health check | `https://your-domain.com/api/slack/command` |

### 1.6 Install the App
1. Go to **"Install App"**
2. Click **"Install to Workspace"**
3. Authorize the requested permissions
4. Copy the **Bot User OAuth Token** (starts with `xoxb-`)
5. Copy the **Signing Secret** from **"Basic Information"**

## 🔐 Step 2: Configure Environment Variables

Create or update your `.env` file with the Slack credentials:

```bash
# Slack Bot Configuration
SLACK_BOT_TOKEN=xoxb-your-bot-user-oauth-token
SLACK_APP_TOKEN=xapp-your-app-level-token
SLACK_SIGNING_SECRET=your-signing-secret

# Channel Configuration (Optional - defaults shown)
SLACK_ALERTS_CHANNEL=#claude-alerts
SLACK_STATUS_CHANNEL=#claude-status
SLACK_COMMANDS_CHANNEL=#claude-control
SLACK_GENERAL_CHANNEL=#claude-general
```

### Environment Variable Details

| Variable | Required | Description |
|----------|----------|-------------|
| `SLACK_BOT_TOKEN` | ✅ | Bot User OAuth Token (xoxb-...) |
| `SLACK_APP_TOKEN` | ✅ | App-Level Token for Socket Mode (xapp-...) |
| `SLACK_SIGNING_SECRET` | ✅ | Signing secret for request verification |
| `SLACK_ALERTS_CHANNEL` | ❌ | Channel for critical alerts (default: #claude-alerts) |
| `SLACK_STATUS_CHANNEL` | ❌ | Channel for status updates (default: #claude-status) |
| `SLACK_COMMANDS_CHANNEL` | ❌ | Channel for command responses (default: #claude-control) |
| `SLACK_GENERAL_CHANNEL` | ❌ | Channel for general notifications (default: #claude-general) |

## 📢 Step 3: Create Slack Channels

Create the following channels in your Slack workspace:

```bash
#claude-alerts    - Critical system alerts and warnings
#claude-status    - Project status updates and health checks
#claude-control   - Command responses and interactive features
#claude-general   - General notifications and updates
```

### Channel Purposes

- **#claude-alerts**: Receives critical alerts like system failures, security issues, and urgent warnings
- **#claude-status**: Gets project status changes, deployment updates, and health check results
- **#claude-control**: Used for interactive commands and their responses
- **#claude-general**: Receives general notifications, startup messages, and non-critical updates

## ⚡ Step 4: Start the Daemon

Restart your Claude Code Daemon to load the new Slack configuration:

```bash
# Stop the current instance
npm stop

# Start with new environment variables
npm start
```

Or if using Docker:

```bash
docker-compose down
docker-compose up -d
```

## ✅ Step 5: Test the Integration

### 5.1 Using the Web Interface
1. Open your dashboard: `http://localhost:5000`
2. Navigate to **Slack Config** page: `http://localhost:5000/slack-config`
3. Verify connection status
4. Test message sending
5. Validate channel configuration

### 5.2 Using Slack Commands
Try these commands in your Slack workspace:

```bash
/claude-help                    # Show all available commands
/claude-status                  # Get system status
/claude-projects                # List all projects
/claude-start my-project        # Start Claude Code for a project
/claude-health                  # Perform health check
```

### 5.3 Mention the Bot
Try mentioning the bot in any channel:
```
@Claude Code Daemon status
@Claude Code Daemon help
```

## 🎛️ Configuration Management

### Using the Web Interface
Visit `http://localhost:5000/slack-config` to:
- View connection status
- Update channel configuration
- Test message sending
- Validate setup
- View available commands

### Using API Endpoints
You can also manage configuration via REST API:

```bash
# Get Slack status
curl http://localhost:5000/api/slack/status

# Update channel configuration
curl -X PUT http://localhost:5000/api/slack/channels \
  -H "Content-Type: application/json" \
  -d '{"channels": {"alerts": "#new-alerts-channel"}}'

# Send test message
curl -X POST http://localhost:5000/api/slack/message \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello from API!", "channel": "general"}'
```

## 📊 Available Commands

| Command | Parameters | Description |
|---------|------------|-------------|
| `/claude-help` | - | Show all available commands |
| `/claude-status` | - | Get system status and health |
| `/claude-projects` | - | List all projects with status |
| `/claude-start` | `[project-name]` | Start Claude Code for project |
| `/claude-stop` | `[project-name]` | Stop Claude Code for project |
| `/claude-bmad` | `[project-name] [workflow]` | Start BMAD workflow |
| `/claude-logs` | `[lines]` | Get recent logs (default: 10) |
| `/claude-alerts` | - | Get recent alerts |
| `/claude-usage` | - | Get usage statistics |
| `/claude-health` | - | Perform comprehensive health check |

### Command Examples

```bash
# Basic commands
/claude-status
/claude-projects
/claude-health

# Project management
/claude-start my-awesome-project
/claude-stop my-awesome-project
/claude-bmad startup-app agile

# Monitoring
/claude-logs 20
/claude-alerts
/claude-usage
```

## 🔔 Notification Types

### Alert Notifications
- **Critical**: System failures, security issues → `#claude-alerts`
- **Warning**: Performance issues, resource limits → `#claude-alerts`
- **Info**: General information → `#claude-general`

### Status Updates
- Project status changes → `#claude-status`
- Health check results → `#claude-status`
- Deployment updates → `#claude-status`

### Activity Notifications
- Claude Code sessions started/stopped → `#claude-status`
- BMAD workflows initiated → `#claude-status`
- User actions via Slack commands → `#claude-control`

## 🛠️ Troubleshooting

### Common Issues

#### 1. Bot Not Responding
**Symptoms**: Commands don't work, no responses
**Solutions**:
- Check environment variables are set correctly
- Verify bot token starts with `xoxb-`
- Ensure Socket Mode is enabled
- Check server logs for connection errors

#### 2. Permission Denied
**Symptoms**: "Permission denied" errors in channels
**Solutions**:
- Invite bot to channels: `/invite @Claude Code Daemon`
- Check bot permissions in Slack app settings
- Verify OAuth scopes include `chat:write` and `chat:write.public`

#### 3. Commands Not Working
**Symptoms**: Slash commands return errors
**Solutions**:
- Verify Request URL in Slack app settings
- Check signing secret is correct
- Ensure server is accessible from internet (for slash commands)
- Use Socket Mode for real-time events

#### 4. Messages Not Appearing
**Symptoms**: Test messages don't appear in channels
**Solutions**:
- Check channel names start with `#` or use channel IDs
- Verify bot is member of target channels
- Check notification service logs

### Debug Mode

Enable debug logging by setting:
```bash
LOG_LEVEL=debug
```

### Health Check

Use the health check endpoint to verify integration:
```bash
curl http://localhost:5000/api/slack/status
```

## 🔒 Security Considerations

1. **Token Security**: Store tokens securely, never commit to version control
2. **Request Verification**: Signing secret is used to verify requests from Slack
3. **Channel Permissions**: Only invite bot to channels where it's needed
4. **Rate Limiting**: Slack has rate limits, the bot handles these automatically
5. **Error Handling**: Sensitive information is not exposed in error messages

## 🚀 Advanced Configuration

### Custom Channel Routing

You can customize which notifications go to which channels:

```javascript
// In your notification service
await notificationService.updateSlackChannels({
  alerts: '#critical-alerts',
  status: '#dev-status',
  commands: '#bot-commands',
  general: '#general'
});
```

### Programmatic Notifications

Send custom notifications from your code:

```javascript
// Send alert
await notificationService.sendAlert({
  type: 'deployment',
  severity: 'info',
  message: 'Deployment completed successfully',
  data: { version: '1.2.3', environment: 'production' }
});

// Send status update
await notificationService.notifyProjectStatusChange(
  'my-project', 'development', 'production', 'user123'
);

// Send Claude session notification
await notificationService.notifyClaudeSession(
  'started', 'my-project', 'user123'
);
```

## 📚 API Reference

For complete API documentation, visit: `http://localhost:5000/api/slack/commands`

## 🆘 Support

If you encounter issues:

1. Check the [troubleshooting section](#troubleshooting)
2. Review server logs in `logs/slack.log`
3. Test the connection using the web interface
4. Verify all environment variables are set correctly
5. Check Slack app configuration matches this guide

## 🔄 Updates and Maintenance

- **Bot Token Rotation**: Update `SLACK_BOT_TOKEN` and restart service
- **Channel Changes**: Update via web interface or environment variables
- **Permission Updates**: Update OAuth scopes in Slack app settings
- **Command Changes**: Modify slash commands in Slack app settings

---

**📝 Note**: This integration enhances your development workflow by bringing Claude Code Daemon functionality directly into your team's communication platform. Enjoy seamless project management and monitoring from Slack! 🎉