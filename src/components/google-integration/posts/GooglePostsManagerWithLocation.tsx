import { useEffect, useState } from "react";
import { GooglePostsManager } from "./GooglePostsManager";
import { useGoogleLocations } from "@/hooks/use-google-locations";

interface GooglePostsManagerWithLocationProps {
    siteSlug: string;
}

export function GooglePostsManagerWithLocation({ siteSlug }: GooglePostsManagerWithLocationProps) {
    const { locations, fetchLocations } = useGoogleLocations();
    const [locationId, setLocationId] = useState<string | undefined>();

    useEffect(() => {
        fetchLocations(siteSlug);
    }, [siteSlug]);

    useEffect(() => {
        if (locations.length > 0) {
            const primaryLocation = locations.find(l => l.is_primary) || locations[0];
            if (primaryLocation?.location_id) {
                // Construir locationId completo: accounts/{accountId}/locations/{locationId}
                const accountId = primaryLocation.account_id?.split('/').pop() || primaryLocation.account_id;
                const fullLocationId = `accounts/${accountId}/locations/${primaryLocation.location_id}`;
                setLocationId(fullLocationId);
            }
        }
    }, [locations]);

    return <GooglePostsManager locationId={locationId} />;
}

