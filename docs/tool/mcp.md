# MCP Tools Reference

> Model Context Protocol (MCP) tools available in this project's Claude Code environment.

---

## 1. shadcn/ui (UI Components)

Component library for building React interfaces with Tailwind CSS.

| Tool | Description | Parameters |
|------|-------------|------------|
| `mcp__shadcn__list-components` | List all available shadcn/ui components | - |
| `mcp__shadcn__get-component-docs` | Get documentation for a specific component | `component`: string |
| `mcp__shadcn__install-component` | Install a component | `component`: string, `runtime?`: npm/pnpm/yarn/bun |
| `mcp__shadcn__list-blocks` | List all available shadcn/ui blocks | - |
| `mcp__shadcn__get-block-docs` | Get documentation for a specific block | `block`: string |
| `mcp__shadcn__install-blocks` | Install a block | `block`: string, `runtime?`: npm/pnpm/yarn/bun |

### Use Cases

- Install UI primitives (Button, Dialog, Card, etc.) for `flow-viz-react/`
- Get component documentation and usage examples
- Install pre-built blocks (dashboard layouts, forms, etc.)

### Example Usage

```plaintext
# List available components
mcp__shadcn__list-components

# Get Button docs
mcp__shadcn__get-component-docs(component="button")

# Install Dialog component with npm
mcp__shadcn__install-component(component="dialog", runtime="npm")
```

---

## 2. Playwright (Browser Automation)

Browser automation for E2E testing and visual validation.

### Navigation & Page Control

| Tool | Description | Key Parameters |
|------|-------------|----------------|
| `mcp__playwright__browser_navigate` | Navigate to a URL | `url`: string |
| `mcp__playwright__browser_navigate_back` | Go back to previous page | - |
| `mcp__playwright__browser_close` | Close the page | - |
| `mcp__playwright__browser_resize` | Resize browser window | `width`, `height`: number |
| `mcp__playwright__browser_tabs` | List/create/close/select tabs | `action`: list/new/close/select |

### Inspection & Screenshots

| Tool | Description | Key Parameters |
|------|-------------|----------------|
| `mcp__playwright__browser_snapshot` | Capture accessibility snapshot (preferred) | `filename?`: string |
| `mcp__playwright__browser_take_screenshot` | Take a screenshot | `filename?`, `fullPage?`, `type?` |
| `mcp__playwright__browser_console_messages` | Get console messages | `level?`: error/warning/info/debug |
| `mcp__playwright__browser_network_requests` | Get network requests | `includeStatic?`: boolean |

### Interaction

| Tool | Description | Key Parameters |
|------|-------------|----------------|
| `mcp__playwright__browser_click` | Click on an element | `element`: string, `ref`: string |
| `mcp__playwright__browser_type` | Type text into element | `element`, `ref`, `text`: string |
| `mcp__playwright__browser_fill_form` | Fill multiple form fields | `fields`: array of field objects |
| `mcp__playwright__browser_hover` | Hover over element | `element`, `ref`: string |
| `mcp__playwright__browser_drag` | Drag and drop | `startElement`, `startRef`, `endElement`, `endRef` |
| `mcp__playwright__browser_select_option` | Select dropdown option | `element`, `ref`, `values`: array |
| `mcp__playwright__browser_press_key` | Press keyboard key | `key`: string (e.g., "Enter", "ArrowLeft") |
| `mcp__playwright__browser_file_upload` | Upload files | `paths`: array of absolute paths |

### Advanced

| Tool | Description | Key Parameters |
|------|-------------|----------------|
| `mcp__playwright__browser_evaluate` | Run JavaScript on page | `function`: string |
| `mcp__playwright__browser_run_code` | Run Playwright code snippet | `code`: string |
| `mcp__playwright__browser_wait_for` | Wait for condition | `text?`, `textGone?`, `time?` |
| `mcp__playwright__browser_handle_dialog` | Handle browser dialogs | `accept`: boolean, `promptText?` |
| `mcp__playwright__browser_install` | Install browser if missing | - |

### Use Cases

- E2E testing of `flow-viz-react/` application
- Visual validation of production flow UI
- Testing login flow and authentication
- Validating API responses rendered in browser
- Automated form filling for QC decisions

### Example Workflow

```plaintext
# 1. Navigate to app
mcp__playwright__browser_navigate(url="http://localhost:5173")

# 2. Take accessibility snapshot (better for interaction)
mcp__playwright__browser_snapshot()

# 3. Click login button (ref from snapshot)
mcp__playwright__browser_click(element="Login button", ref="btn-login")

# 4. Fill login form
mcp__playwright__browser_fill_form(fields=[
  {"name": "Email", "type": "textbox", "ref": "input-email", "value": "admin@flowviz.com"}
])

# 5. Take screenshot for documentation
mcp__playwright__browser_take_screenshot(filename="login-page.png")
```

---

## Best Practices

1. **Use `browser_snapshot` over `browser_take_screenshot`** - Snapshots provide accessible element refs for interaction
2. **Always get a snapshot first** - Element refs (`ref` parameter) come from snapshots
3. **Use descriptive `element` names** - Helps with permission prompts and logging
4. **Install browser if needed** - Run `mcp__playwright__browser_install` if you get browser not found errors

---

## Related Documentation

- [shadcn/ui Docs](https://ui.shadcn.com/)
- [Playwright Docs](https://playwright.dev/)
- [MCP Protocol](https://modelcontextprotocol.io/)
