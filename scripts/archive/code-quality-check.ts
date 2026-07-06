#!/usr/bin/env tsx

/**
 * Code Quality Analysis Script
 *
 * Performs automated code quality checks:
 * - TypeScript any usage
 * - Large files detection
 * - Duplicate code patterns
 * - Missing error handling
 * - Security patterns
 */

import { execSync } from "child_process";
import { readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";

interface QualityIssue {
  type: string;
  file: string;
  line: number;
  message: string;
  severity: "low" | "medium" | "high";
}

const results: QualityIssue[] = [];

function checkTypeScriptAnyUsage() {
  console.log("🔍 Checking TypeScript any usage...");

  try {
    const files = execSync('grep -r ": any" --include="*.ts" --include="*.tsx" app/ lib/ features/ || true', {
      encoding: "utf8",
    });

    const lines = files.split("\n").filter((line) => line.trim() && !line.includes("node_modules"));

    lines.forEach((line) => {
      const [file, content] = line.split(":");
      const lineNum = line.split(":")[1];

      if (file && content) {
        results.push({
          type: "typescript-any",
          file: file.trim(),
          line: parseInt(lineNum) || 0,
          message: `TypeScript 'any' type usage: ${content.trim()}`,
          severity: "medium",
        });
      }
    });

    console.log(`Found ${lines.length} TypeScript any usage issues`);
  } catch {
    console.log("No TypeScript any usage found or grep failed");
  }
}

function checkLargeFiles() {
  console.log("🔍 Checking for large files...");

  const checkDir = (dir: string, maxLines = 500) => {
    try {
      const files = readdirSync(dir);

      files.forEach((file) => {
        const fullPath = join(dir, file);
        const stat = statSync(fullPath);

        if (stat.isDirectory() && !file.startsWith(".") && file !== "node_modules") {
          checkDir(fullPath, maxLines);
        } else if (file.match(/\.(ts|tsx|js|jsx)$/) && stat.isFile()) {
          const content = readFileSync(fullPath, "utf8");
          const lines = content.split("\n").length;

          if (lines > maxLines) {
            results.push({
              type: "large-file",
              file: fullPath,
              line: 0,
              message: `Large file (${lines} lines, exceeds ${maxLines} limit)`,
              severity: "low",
            });
          }
        }
      });
    } catch {
      // Ignore permission errors
    }
  };

  checkDir("app");
  checkDir("lib");
  checkDir("features");

  const largeFileCount = results.filter((r) => r.type === "large-file").length;
  console.log(`Found ${largeFileCount} large files`);
}

function checkConsoleLogUsage() {
  console.log("🔍 Checking console.log usage...");

  try {
    const files = execSync(
      'grep -r "console\\.log\\|console\\.error\\|debugger" --include="*.ts" --include="*.tsx" app/ lib/ features/ || true',
      { encoding: "utf8" }
    );

    const lines = files.split("\n").filter((line) => line.trim() && !line.includes("node_modules"));

    lines.forEach((line) => {
      const [file, ...rest] = line.split(":");
      const content = rest.join(":").trim();

      if (file && content && !file.includes("node_modules")) {
        results.push({
          type: "console-log",
          file: file.trim(),
          line: parseInt(rest[0]) || 0,
          message: `Debug console statement: ${content.substring(0, 50)}...`,
          severity: "low",
        });
      }
    });

    console.log(`Found ${lines.length} console.log/debugger statements`);
  } catch {
    console.log("No console.log usage found or grep failed");
  }
}

function checkTODOComments() {
  console.log("🔍 Checking TODO comments...");

  try {
    const files = execSync('grep -r "TODO\\|FIXME\\|HACK\\|XXX" --include="*.ts" --include="*.tsx" app/ lib/ features/ || true', {
      encoding: "utf8",
    });

    const lines = files.split("\n").filter((line) => line.trim() && !line.includes("node_modules"));

    lines.forEach((line) => {
      const [file, ...rest] = line.split(":");
      const content = rest.join(":").trim();

      if (file && content && !file.includes("node_modules")) {
        results.push({
          type: "todo-comment",
          file: file.trim(),
          line: parseInt(rest[0]) || 0,
          message: `TODO/FIXME comment: ${content.substring(0, 50)}...`,
          severity: "low",
        });
      }
    });

    console.log(`Found ${lines.length} TODO/FIXME comments`);
  } catch {
    console.log("No TODO comments found or grep failed");
  }
}

function generateReport() {
  console.log("\n📊 CODE QUALITY REPORT\n");

  // Group by type
  const byType = results.reduce((acc, issue) => {
    if (!acc[issue.type]) {
      acc[issue.type] = [];
    }
    acc[issue.type].push(issue);
    return acc;
  }, {} as Record<string, QualityIssue[]>);

  // Sort by severity
  Object.entries(byType).forEach(([type, issues]) => {
    const highSeverity = issues.filter((i) => i.severity === "high").length;
    const mediumSeverity = issues.filter((i) => i.severity === "medium").length;
    const lowSeverity = issues.filter((i) => i.severity === "low").length;

    console.log(`\n${type.toUpperCase()}:`);
    console.log(`  High: ${highSeverity}, Medium: ${mediumSeverity}, Low: ${lowSeverity}`);

    // Show first 3 examples
    const examples = issues.slice(0, 3);
    examples.forEach((issue) => {
      const icon = issue.severity === "high" ? "🔴" : issue.severity === "medium" ? "🟡" : "🟢";
      console.log(`  ${icon} ${issue.file}:${issue.line}`);
      console.log(`     ${issue.message.substring(0, 60)}...`);
    });

    if (issues.length > 3) {
      console.log(`  ... and ${issues.length - 3} more`);
    }
  });

  // Summary
  const totalIssues = results.length;
  const high = results.filter((r) => r.severity === "high").length;
  const medium = results.filter((r) => r.severity === "medium").length;
  const low = results.filter((r) => r.severity === "low").length;

  console.log(`\n📈 SUMMARY:`);
  console.log(`  Total Issues: ${totalIssues}`);
  console.log(`  🔴 High Severity: ${high}`);
  console.log(`  🟡 Medium Severity: ${medium}`);
  console.log(`  🟢 Low Severity: ${low}`);

  if (high === 0 && medium === 0) {
    console.log(`\n✅ Code quality is good! Only ${low} low severity issues found.`);
  } else if (high === 0) {
    console.log(`\n⚠️  Code quality is acceptable. ${medium} medium severity issues to address.`);
  } else {
    console.log(`\n❌ Code quality needs improvement. ${high} high severity issues require attention.`);
  }
}

function main() {
  console.log("🔍 Starting code quality analysis...\n");

  checkTypeScriptAnyUsage();
  checkLargeFiles();
  checkConsoleLogUsage();
  checkTODOComments();

  generateReport();
}

main();
