#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "Components/InstancedStaticMeshComponent.h"
#include "VelaraCityBuilder.generated.h"

/**
 * VELARA mixed-city builder — factory ke gen-city-layout.py se bana
 * city_layout.json padhkar InstancedStaticMesh instances spawn karta hai.
 * Meshes /Game/Meshes/{name} par setup_assets.py se import hoti hain
 * (tower-glass, midrise-concrete, shop-low, shop-enterable, hydrant, ...).
 *
 * Mapping (three.js -> UE): X = x, Y = z, Z = up. Yaw sign agar ulta lage
 * to bFlipYaw toggle karo.
 */
UCLASS()
class VELARAUE_API AVelaraCityBuilder : public AActor
{
	GENERATED_BODY()

public:
	AVelaraCityBuilder();

	// konse mesh kinds load karne hain (setup_assets.py ke import names)
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Velara")
	TArray<FString> MeshKinds;

	// three.js Y-rotation ka UE yaw sign flip (preview mein galat dikhe to toggle)
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Velara")
	bool bFlipYaw = true;

	// ek hi kind ke kitne instances tak spawn karein (0 = sab)
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Velara", meta = (ClampMin = "0"))
	int32 MaxPerKind = 0;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Velara")
	int32 SpawnedKinds = 0;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Velara")
	int32 SpawnedInstances = 0;

protected:
	virtual void BeginPlay() override;
	virtual void OnConstruction(const FTransform& Transform) override;

private:
	bool BuildFromJson();
	UInstancedStaticMeshComponent* GetISMFor(const FString& Kind, const FString& MeshPath);
	TMap<FString, UInstancedStaticMeshComponent*> ISMs;
};
