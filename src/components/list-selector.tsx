"use client";

import { useState, useEffect } from "react";
import { Check, CheckSquare, Square } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

interface ListSelectorProps {
    initialItems?: string[];
    onSelectionChange?: (selectedItems: string[]) => void;
}

export default function ListSelector({
    initialItems = [],
    onSelectionChange
}: ListSelectorProps) {
    const [items, setItems] = useState<string[]>([]);
    const [selected, setSelected] = useState<string[]>([]);

    // 初始化列表，去重处理
    useEffect(() => {
        const uniqueItems = Array.from(new Set(initialItems));
        setItems(uniqueItems);
    }, [initialItems]);

    // 当选择变化时通知父组件
    useEffect(() => {
        onSelectionChange?.(selected);
    }, [selected, onSelectionChange]);

    // 切换单个项目的选择状态
    const toggleSelect = (item: string) => {
        setSelected(prev =>
            prev.includes(item)
                ? prev.filter(i => i !== item)
                : [...prev, item]
        );
    };

    // 全选/取消全选
    const toggleSelectAll = () => {
        if (selected.length === items.length) {
            setSelected([]);
        } else {
            setSelected([...items]);
        }
    };

    const allSelected = items.length > 0 && selected.length === items.length;
    const partiallySelected = selected.length > 0 && selected.length < items.length;

    return (
        <Card className="w-full max-w-md border shadow-sm">
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-lg font-medium">选择项目</CardTitle>
                    <Badge variant="outline" className="px-2 py-1 text-xs">
                        {items.length} 个项目
                    </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                    已选择 {selected.length} 个项目
                </p>
            </CardHeader>

            <Separator />

            <CardContent className="pt-4">
                {/* 控制栏 */}
                <div className="flex items-center justify-between mb-4">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={toggleSelectAll}
                        className="h-8 px-3 gap-2"
                    >
                        {allSelected ? (
                            <>
                                <CheckSquare className="h-4 w-4" />
                                取消全选
                            </>
                        ) : (
                            <>
                                <Square className="h-4 w-4" />
                                全选
                            </>
                        )}
                    </Button>

                    {partiallySelected && (
                        <span className="text-xs text-muted-foreground">
                            {selected.length} / {items.length} 已选
                        </span>
                    )}
                </div>

                {/* 项目列表 */}
                <div className="space-y-1 max-h-80 overflow-y-auto rounded-md border p-1">
                    {items.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground text-sm">
                            列表为空
                        </div>
                    ) : (
                        items.map((item) => (
                            <div
                                key={item}
                                className={`flex items-center gap-3 px-3 py-2 rounded-md cursor-pointer transition-all hover:bg-accent ${selected.includes(item)
                                    ? "bg-primary/10 border border-primary/20"
                                    : ""
                                    }`}
                                onClick={() => toggleSelect(item)}
                            >
                                {/* 复选框 */}
                                <div className={`flex-shrink-0 h-5 w-5 rounded-sm border flex items-center justify-center transition-colors ${selected.includes(item)
                                    ? "bg-primary border-primary"
                                    : "border-muted-foreground"
                                    }`}>
                                    {selected.includes(item) && (
                                        <Check className="h-3.5 w-3.5 text-primary-foreground" />
                                    )}
                                </div>

                                {/* 项目内容 */}
                                <span className="flex-1 text-sm font-medium">
                                    {item}
                                </span>

                                {/* 选中标记 */}
                                {selected.includes(item) && (
                                    <Badge
                                        variant="secondary"
                                        className="h-5 px-2 text-xs font-normal"
                                    >
                                        已选
                                    </Badge>
                                )}
                            </div>
                        ))
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
