# Development Workflow - Quick Reference

## Branch Strategy

### Initial Setup
```bash
# Start from main
git checkout main
git pull origin main

# Create feature branch
git checkout -b feature/v5-enhancements

# Push feature branch
git push -u origin feature/v5-enhancements
```

### Daily Workflow
```bash
# Always work on feature branch
git checkout feature/v5-enhancements

# Make changes
# ... code ...

# Commit with descriptive messages
git add .
git commit -m "feat(logging): add colorful directional logging with emojis"
git push origin feature/v5-enhancements
```

### After Each Round
```bash
# Update roadmap
# Edit REFACTORING_PLAN.md with completion status

git add REFACTORING_PLAN.md
git commit -m "docs: update roadmap after round X completion"
git push origin feature/v5-enhancements
```

### When Phase is Complete and Tested
```bash
# Merge to main only when stable
git checkout main
git pull origin main
git merge feature/v5-enhancements
git push origin main

# Continue on feature branch
git checkout feature/v5-enhancements
```

## Commit Message Convention

Use conventional commits:

```
feat(scope): description       # New feature
fix(scope): description        # Bug fix
docs(scope): description       # Documentation
refactor(scope): description   # Code refactoring
test(scope): description       # Tests
chore(scope): description      # Maintenance
```

Examples:
```bash
git commit -m "feat(logging): add emoji support and directional indicators"
git commit -m "feat(api): implement JWT authentication"
git commit -m "feat(web-ui): create zone control page"
git commit -m "fix(playwright): close browser after idle timeout"
git commit -m "docs: update roadmap after logging phase"
```

## Development Priorities

### Round 1: Logging (Week 1)
```bash
# Focus files:
src/logging/enhanced-logger.ts
src/logging/log-formatter.ts
src/logging/command-tracker.ts
```

### Round 2-3: API (Week 2-3)
```bash
# Focus files:
src/api/server.ts
src/api/routes/*.ts
src/api/controllers/*.ts
```

### Round 4-6: Web UI (Week 4-6)
```bash
# Focus files:
web-ui/src/pages/*.tsx
web-ui/src/components/*.tsx
```

### Round 7: Playwright (Week 7)
```bash
# Focus files:
src/playwright-https-client.ts
src/rehau-auth.ts
```

## Testing Strategy

### After Each Feature
```bash
# Run existing tests (if any)
npm test

# Manual testing
npm run dev

# Check logs for errors
# Test on real REHAU system
```

### Before Merging to Main
```bash
# Full integration test
# Test on Raspberry Pi
# Test for 24 hours
# Verify all existing features work
```

## Roadmap Updates

### Template for Round Completion

Add this to REFACTORING_PLAN.md after each round:

```markdown
## Round X Completion: [DATE]

### What Worked ✅
- Feature A implemented successfully
- Performance better than expected
- Users love the new UI

### What Didn't Work ❌
- Feature B took longer than planned
- Memory usage higher than target
- OAuth2 setup more complex

### Adjustments Needed 🔧
- Extend timeline for feature B by 2 days
- Add memory optimization task
- Simplify OAuth2 wizard

### Next Steps ➡️
- Continue with next priority
- Address issues from this round
- Update timeline if needed

### Metrics 📊
- Memory usage: 120MB (target: 150MB) ✅
- API response time: 340ms (target: 500ms) ✅
- Test coverage: 45% (target: 60%) ⚠️
```

## Quick Commands

### Start Development
```bash
cd rehau-nea-smart-2-home-assistant/rehau-nea-smart-mqtt-bridge
npm install
npm run dev
```

### Build
```bash
npm run build
```

### Test
```bash
npm test
```

### Docker Build
```bash
docker build -t rehau-bridge:dev .
docker run -it --rm rehau-bridge:dev
```

### Web UI Development
```bash
cd web-ui
npm install
npm run dev
```

## Important Reminders

1. ✅ **Always work on feature branch**
2. ✅ **Update roadmap after each round**
3. ✅ **Test before merging to main**
4. ✅ **Use descriptive commit messages**
5. ✅ **Have fun with colors and emojis!** 🎉

## Emergency Rollback

If something breaks:

```bash
# Revert to last working commit
git checkout main
git log  # Find last good commit
git reset --hard <commit-hash>
git push origin main --force

# Or revert specific commit
git revert <commit-hash>
git push origin main
```

## Getting Help

- Check existing code for patterns
- Review REFACTORING_PLAN.md for context
- Test on real REHAU system
- Document issues in roadmap updates

---

**Remember**: This is a FUN project! Use colors 🎨, emojis 😊, and make it enjoyable! 🚀
