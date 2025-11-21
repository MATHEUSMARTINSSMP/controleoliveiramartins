import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function MetasManagement() {
    return (
        <div className="p-10 bg-red-100 text-red-900">
            <h1 className="text-2xl font-bold">DEBUG MODE: Metas Management</h1>
            <p>Se você está vendo isso, a rota está funcionando e o erro estava no código anterior.</p>
            <Button onClick={() => window.location.href = '/admin'}>Voltar para Admin</Button>
        </div>
    );
}
