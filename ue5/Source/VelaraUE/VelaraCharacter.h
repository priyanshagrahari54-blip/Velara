#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Character.h"
#include "Camera/CameraComponent.h"
#include "GameFramework/SpringArmComponent.h"
#include "VelaraCharacter.generated.h"

/**
 * VELARA foot hero — third-person chase camera (GTA-style spring arm),
 * sprint, jump. Legacy axis mappings (DefaultInput.ini) — Phase-2 mein
 * EnhancedInput + mobile touch widgets.
 */
UCLASS()
class VELARAUE_API AVelaraCharacter : public ACharacter
{
	GENERATED_BODY()

public:
	AVelaraCharacter();

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Velara")
	USpringArmComponent* CameraBoom;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Velara")
	UCameraComponent* FollowCamera;

	// walk vs sprint (units/cm)
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Velara")
	float WalkSpeed = 420.0f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Velara")
	float SprintSpeed = 780.0f;

protected:
	virtual void SetupPlayerInputComponent(class UInputComponent* PlayerInputComponent) override;
	virtual void BeginPlay() override;

	void OnMoveForward(float Val);
	void OnMoveRight(float Val);
	void OnTurn(float Val);
	void OnLookUp(float Val);
	void OnStartSprint();
	void OnStopSprint();
};
