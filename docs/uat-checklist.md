# User Acceptance Testing (UAT) Checklist

This document provides a comprehensive UAT checklist for validating the Vacation Timeline widget before production launch.

## Pre-UAT Setup

### Environment Preparation
- [ ] Dev/staging environment deployed with latest code
- [ ] Test users created in Staffbase
- [ ] Test vacation events created in Microsoft 365 calendars
- [ ] API key configured in widget
- [ ] CORS configured for test Staffbase domain

### Test Data Requirements
- [ ] At least 3 test users with vacation events
- [ ] Overlapping vacations (same dates, different users)
- [ ] Multi-day vacation events
- [ ] Single-day vacation events
- [ ] Events spanning month boundaries
- [ ] Current week events (for "Today" marker testing)

---

## Functional Testing

### Widget Loading
| Test Case | Steps | Expected Result | Pass/Fail |
|-----------|-------|-----------------|-----------|
| Initial load | Open page with widget | Widget loads without errors, shows loading state then data | |
| Configuration missing | Remove API key from config | Shows "Widget configuration is incomplete" message | |
| Invalid API key | Use wrong API key | Shows error message with retry option | |
| Network error | Disconnect network, reload | Shows error message with retry option | |
| Empty data | Use date range with no events | Shows "No vacations scheduled" message | |

### View Navigation
| Test Case | Steps | Expected Result | Pass/Fail |
|-----------|-------|-----------------|-----------|
| Day view | Click "Day" button | Shows single day, hour columns | |
| Week view | Click "Week" button | Shows 7 days, date columns | |
| Month view | Click "Month" button | Shows full month grid | |
| Timeline view | Click "Timeline" button | Shows extended timeline | |
| Next navigation | Click ">" button | Moves forward by view period | |
| Previous navigation | Click "<" button | Moves backward by view period | |
| Today button | Navigate away, click "Today" | Returns to current date | |

### Date Display
| Test Case | Steps | Expected Result | Pass/Fail |
|-----------|-------|-----------------|-----------|
| Date label format | View each mode | Correct format for each view type | |
| Month boundary | Navigate to month start/end | Correct dates shown | |
| Year boundary | Navigate to December/January | Correct year shown | |
| Today marker | View current week | Red vertical line at today | |

### User Filter
| Test Case | Steps | Expected Result | Pass/Fail |
|-----------|-------|-----------------|-----------|
| All users (default) | Load widget | All users shown | |
| Single user | Select one user | Only that user's events shown | |
| Multiple users | Select multiple users | Selected users' events shown | |
| Only Me | Click "Only Me" | Current user highlighted/filtered | |
| Clear selection | Click "All" | All users shown again | |
| Max users limit | Have >20 users | Shows max configured users | |

### Timeline Display
| Test Case | Steps | Expected Result | Pass/Fail |
|-----------|-------|-----------------|-----------|
| Event bars | View timeline | Colored bars for each vacation | |
| Bar positioning | Compare with calendar | Bars align with correct dates | |
| Overlapping events | User with overlapping vacations | Both events visible | |
| Multi-day events | View multi-day vacation | Bar spans correct days | |
| User rows | Multiple users | Each user has separate row | |
| Color consistency | Navigate views | Same user = same color | |

### Legend
| Test Case | Steps | Expected Result | Pass/Fail |
|-----------|-------|-----------------|-----------|
| Legend display | View with events | Legend shows user colors | |
| Color matching | Compare legend to bars | Colors match timeline bars | |
| Current user indicator | Logged in as test user | Shows "You" or highlight | |
| Legend updates | Filter users | Legend reflects filtered users | |

### SAML Deep Link (Optional)
| Test Case | Steps | Expected Result | Pass/Fail |
|-----------|-------|-----------------|-----------|
| Button visibility | Enable feature in config | "Open in Outlook" button appears | |
| Button hidden | Disable feature in config | Button not shown | |
| SSO redirect | Click button | Opens Outlook with SSO | |
| Correct calendar | After SSO | Lands on calendar page | |

---

## User Context Testing

### Staffbase User Recognition
| Test Case | Steps | Expected Result | Pass/Fail |
|-----------|-------|-----------------|-----------|
| User detected | Log in as test user | Widget recognizes user | |
| M365 UPN mapping | Check "Only Me" filter | Correct user highlighted | |
| Email-based mapping | User email = M365 UPN | Mapping works correctly | |
| Custom profile field | Set m365Upn field | Mapping uses custom field | |
| Fallback domain | Configure fallback | UPN constructed correctly | |
| Anonymous user | View without login | Widget works (no "Only Me") | |

---

## Performance Testing

### Load Time
| Test Case | Steps | Expected Result | Pass/Fail |
|-----------|-------|-----------------|-----------|
| Initial load | Time from page load to data | < 3 seconds | |
| View change | Time to switch views | < 1 second | |
| Navigation | Time to change date range | < 1 second | |
| Large dataset | 50+ events | Renders smoothly | |

### Responsiveness
| Test Case | Steps | Expected Result | Pass/Fail |
|-----------|-------|-----------------|-----------|
| Desktop (1920px) | Test at full width | Full layout visible | |
| Tablet (768px) | Resize to tablet | Responsive layout | |
| Mobile (375px) | Resize to mobile | Touch-friendly, scrollable | |
| Orientation change | Rotate device | Layout adjusts correctly | |

---

## Accessibility Testing

### Keyboard Navigation
| Test Case | Steps | Expected Result | Pass/Fail |
|-----------|-------|-----------------|-----------|
| Tab order | Tab through widget | Logical focus order | |
| Button activation | Tab to button, press Enter | Button activates | |
| View toggle | Tab to views, use arrows | Can change views | |
| Focus visible | Tab through elements | Focus ring visible | |

### Screen Reader
| Test Case | Steps | Expected Result | Pass/Fail |
|-----------|-------|-----------------|-----------|
| Widget label | Navigate to widget | Announces purpose | |
| Button labels | Focus on buttons | Clear descriptions | |
| Event info | Navigate timeline | Announces event details | |
| Error messages | Trigger error | Error announced | |

### Visual
| Test Case | Steps | Expected Result | Pass/Fail |
|-----------|-------|-----------------|-----------|
| Color contrast | Check all text | Meets WCAG AA (4.5:1) | |
| Colorblind safe | Use colorblind simulator | Events distinguishable | |
| High contrast | Enable high contrast mode | Widget remains usable | |
| Text scaling | Increase browser font | Text scales correctly | |

---

## Error Handling

### API Errors
| Test Case | Steps | Expected Result | Pass/Fail |
|-----------|-------|-----------------|-----------|
| 401 Unauthorized | Invalid API key | User-friendly error message | |
| 403 Forbidden | CORS blocked | Error shown, no technical details | |
| 500 Server Error | Force backend error | Error with retry option | |
| Timeout | Slow network | Loading state, then error | |
| Rate limited | Rapid requests | Graceful handling | |

### Recovery
| Test Case | Steps | Expected Result | Pass/Fail |
|-----------|-------|-----------------|-----------|
| Retry button | Click retry after error | Attempts fresh request | |
| Network recovery | Restore network, retry | Data loads successfully | |
| View change after error | Change view after error | New request attempted | |

---

## Browser Compatibility

Test in each browser:

| Browser | Version | Windows | Mac | Mobile |
|---------|---------|---------|-----|--------|
| Chrome | Latest | [ ] | [ ] | [ ] |
| Firefox | Latest | [ ] | [ ] | [ ] |
| Safari | Latest | N/A | [ ] | [ ] |
| Edge | Latest | [ ] | [ ] | N/A |

---

## Sign-Off

### UAT Participants
| Name | Role | Date | Signature |
|------|------|------|-----------|
| | Product Owner | | |
| | QA Lead | | |
| | Tech Lead | | |
| | Pilot User Rep | | |

### Issues Found
| Issue # | Description | Severity | Status |
|---------|-------------|----------|--------|
| | | | |
| | | | |
| | | | |

### Final Approval
- [ ] All critical tests passed
- [ ] All high-severity bugs fixed
- [ ] Performance meets requirements
- [ ] Accessibility requirements met
- [ ] Documentation complete
- [ ] Stakeholder sign-off received

**Approved for Production:** [ ] Yes [ ] No

**Date:** _______________

**Approver:** _______________
