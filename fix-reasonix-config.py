#!/usr/bin/env python3
"""将 planner_model 从 deepseek/deepseek-v4-pro 改为 deepseek/deepseek-v4-flash"""
import os

config_path = os.path.expanduser('~/.reasonix/config.toml')
with open(config_path, 'r') as f:
    content = f.read()

old = 'planner_model = "deepseek/deepseek-v4-pro"'
new = 'planner_model = "deepseek/deepseek-v4-flash"'

if old not in content:
    print("未找到需要替换的内容，可能已修改过。")
    if new in content:
        print("当前值已是 deepseek/deepseek-v4-flash，无需修改。")
    else:
        print("请检查 config.toml 中 planner_model 的当前值。")
else:
    content = content.replace(old, new)
    with open(config_path, 'w') as f:
        f.write(content)
    print("✅ 已修改：planner_model → deepseek/deepseek-v4-flash")