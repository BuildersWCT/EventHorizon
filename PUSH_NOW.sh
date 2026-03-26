#!/bin/bash
# Quick push script for BullMQ integration

echo "📦 Staging all changes..."
git add .

echo "✍️  Committing changes..."
git commit -F backend/COMMIT_MESSAGE.txt

echo "🚀 Pushing to remote..."
git push origin decouple-execution

echo "✅ Done! Your changes are pushed."
echo ""
echo "Next steps:"
echo "1. Create a Pull Request if needed"
echo "2. Share backend/QUICKSTART_QUEUE.md with your team"
echo "3. Install Redis when ready for production"
